
import http from 'node:http'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// --------------------------------------------------
// 1. LOAD ENVIRONMENT VARIABLES
// --------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const envPath = path.join(rootDir, '.env')

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8')

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

// --------------------------------------------------
// 2. CONFIGURATION
// --------------------------------------------------

const PORT = Number(process.env.PORT || 5000)

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN
const META_APP_SECRET = process.env.META_APP_SECRET

const GRAPH_VERSION =
  process.env.META_GRAPH_VERSION || 'v25.0'

const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || 'http://localhost:5173'

function cleanPhone(value) {
  let phone = String(value || '').replace(/\D/g, '')

  if (phone.startsWith('00')) {
    phone = phone.slice(2)
  }

  if (phone.startsWith('0')) {
    phone = '92' + phone.slice(1)
  }

  return phone
}

const ADMIN_WHATSAPP_NUMBER = cleanPhone(
  process.env.ADMIN_WHATSAPP_NUMBER || ''
)

const missing = []

if (!SUPABASE_URL) missing.push('SUPABASE_URL')

if (!SUPABASE_SERVICE_ROLE_KEY) {
  missing.push('SUPABASE_SERVICE_ROLE_KEY')
}

if (!WHATSAPP_TOKEN) missing.push('WHATSAPP_TOKEN')

if (!WHATSAPP_PHONE_NUMBER_ID) {
  missing.push('WHATSAPP_PHONE_NUMBER_ID')
}

if (!META_VERIFY_TOKEN) missing.push('META_VERIFY_TOKEN')

if (!ADMIN_WHATSAPP_NUMBER) {
  missing.push('ADMIN_WHATSAPP_NUMBER')
}

if (!META_APP_SECRET) missing.push('META_APP_SECRET')

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    : null

// --------------------------------------------------
// 2.1 WHATSAPP MESSAGE HISTORY
// --------------------------------------------------

async function saveWhatsAppMessage({
  phone,
  direction,
  message,
  messageId = null
}) {
  if (!supabase) {
    console.error(
      'WhatsApp history: Supabase is not configured'
    )
    return
  }

  const normalizedPhone = cleanPhone(phone)

  if (!normalizedPhone || !message) {
    console.error(
      'WhatsApp history: Invalid phone or empty message'
    )
    return
  }

  try {
    const { error } = await supabase
      .from('whatsapp_messages')
      .insert({
        phone: normalizedPhone,
        direction,
        message: String(message).slice(0, 4000),
        wa_message_id: messageId || null
      })

    if (error) {
      console.error(
        'WhatsApp history save failed:',
        error.message
      )
      return
    }

    console.log(
      `WhatsApp ${direction} message saved successfully`
    )
  } catch (error) {
    console.error(
      'WhatsApp history error:',
      error.message
    )
  }
}

// --------------------------------------------------
// 3. HTTP HELPERS
// --------------------------------------------------

function sendJson(res, statusCode, data) {
  if (res.writableEnded) return

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })

  res.end(JSON.stringify(data))
}

function setCors(req, res) {
  const origin = req.headers.origin

  const allowedOrigins = [
    CLIENT_ORIGIN,
    'http://localhost:5174',
    'http://127.0.0.1:5174'
  ]

  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader(
      'Access-Control-Allow-Origin',
      origin || CLIENT_ORIGIN
    )
  }

  res.setHeader('Vary', 'Origin')

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  )

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Hub-Signature-256'
  )
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []

    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function readRequestJson(req) {
  const raw = await readRawBody(req)

  if (!raw.length) return {}

  return JSON.parse(raw.toString('utf8'))
}

function verifyMetaSignature(rawBody, signature) {
  if (!META_APP_SECRET || !signature) return false

  const expected =
    'sha256=' +
    crypto
      .createHmac('sha256', META_APP_SECRET)
      .update(rawBody)
      .digest('hex')

  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(signature)

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  )
}

// --------------------------------------------------
// 4. WHATSAPP SEND MESSAGE
// --------------------------------------------------

async function sendWhatsApp(to, message) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error('WhatsApp configuration is missing')
  }

  const recipient = cleanPhone(to)

  if (!recipient) {
    throw new Error('Invalid WhatsApp recipient number')
  }

  const messageText = String(message).slice(0, 4000)

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          preview_url: false,
          body: messageText
        }
      })
    }
  )

  const result = await response.json()

  if (!response.ok) {
    console.error('WhatsApp API error:', result)

    throw new Error(
      result?.error?.message || 'WhatsApp message failed'
    )
  }

  const messageId = result?.messages?.[0]?.id || null

  console.log('WhatsApp message accepted:', {
    recipient,
    messageId
  })

  await saveWhatsAppMessage({
    phone: recipient,
    direction: 'outbound',
    message: messageText,
    messageId
  })

  return result
}

async function sendAndLog(to, message, label = 'Notification') {
  try {
    await sendWhatsApp(to, message)

    console.log(
      `${label} sent successfully to ${cleanPhone(to)}`
    )

    return true
  } catch (error) {
    console.error(`${label} failed:`, error.message)
    return false
  }
}

// --------------------------------------------------
// 5. ORDER HELPERS
// --------------------------------------------------

async function findOrder(orderNumber) {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', orderNumber)
    .maybeSingle()

  if (error) {
    console.error('Find order database error:', error)
    throw error
  }

  return data
}

function getCustomerPhone(order) {
  return cleanPhone(
    order?.customer_phone ||
    order?.phone ||
    order?.shipping_phone ||
    ''
  )
}

function getOrderNumber(order) {
  return order?.order_number || order?.id || 'Unknown'
}

function formatPKR(amount) {
  const number = Number(amount)

  if (!Number.isFinite(number)) {
    return String(amount ?? 'N/A')
  }

  return new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 2
  }).format(number)
}

function formatOrderMessage(order) {
  const orderNumber = getOrderNumber(order)
  const customerName = order.customer_name || 'Not provided'
  const customerPhone = getCustomerPhone(order) || 'Not provided'
  const total = formatPKR(
    order.total_amount ?? order.total
  )

  const payment = String(
    order.payment_method || 'Not provided'
  ).toUpperCase()

  const status = String(
    order.order_status || 'Pending'
  ).toUpperCase()

  return [
    '🛍️ *LAPMOB ACCESSORIES*',
    '━━━━━━━━━━━━━━━━━━',
    '',
    '🔔 *NEW ORDER RECEIVED*',
    '',
    '📦 *ORDER DETAILS*',
    `• Order ID: ${orderNumber}`,
    `• Status: 🟡 ${status}`,
    `• Payment: ${payment}`,
    '',
    '👤 *CUSTOMER INFORMATION*',
    `• Name: ${customerName}`,
    `• Phone: ${customerPhone}`,
    '',
    '💰 *PAYMENT SUMMARY*',
    `• Total Amount: *PKR ${total}*`,
    '',
    '━━━━━━━━━━━━━━━━━━',
    '⚡ *ADMIN ACTIONS*',
    '',
    'Reply with one of these commands:',
    '',
    `✅ CONFIRM ${orderNumber}`,
    `❌ CANCEL ${orderNumber}`,
    `🚚 DISPATCH ${orderNumber} 03XXXXXXXXX`,
    '',
    '━━━━━━━━━━━━━━━━━━',
    '*LapMob Accessories*',
    '_Your Technology. Our Priority._'
  ].join('\n')
}

function getCustomerStatusMessage(orderNumber, status) {
  if (status === 'confirmed') {
    return [
      '✅ *ORDER CONFIRMED*',
      '',
      `Your LapMob order *${orderNumber}* has been confirmed.`,
      '',
      'Thank you for shopping with LapMob Accessories!'
    ].join('\n')
  }

  if (status === 'cancelled') {
    return [
      '❌ *ORDER CANCELLED*',
      '',
      `Your LapMob order *${orderNumber}* has been cancelled.`,
      '',
      'Please contact our support team if you need assistance.'
    ].join('\n')
  }

  return ''
}

// --------------------------------------------------
// 6. ADMIN WHATSAPP COMMANDS
// --------------------------------------------------

async function handleAdminCommand(from, message) {
  if (from !== ADMIN_WHATSAPP_NUMBER) {
    console.log('Unauthorized WhatsApp command ignored:', from)
    return
  }

  const parts = message.trim().split(/\s+/)
  const command = (parts[0] || '').toUpperCase()

  if (command === 'HELP') {
    await sendAndLog(
      from,
      [
        '📱 *LAPMOB ADMIN COMMANDS*',
        '━━━━━━━━━━━━━━━━━━',
        '',
        'Available commands:',
        '',
        '🔹 HELP',
        '🔹 CONFIRM ORDER_NUMBER',
        '🔹 CANCEL ORDER_NUMBER',
        '🔹 DISPATCH ORDER_NUMBER 03XXXXXXXXX',
        '',
        'Example:',
        'CONFIRM WT-123456',
        '',
        '━━━━━━━━━━━━━━━━━━',
        '*LapMob Accessories*'
      ].join('\n'),
      'Admin help'
    )

    return
  }

  if (!['CONFIRM', 'CANCEL', 'DISPATCH'].includes(command)) {
    await sendAndLog(
      from,
      '⚠️ Unknown command.\n\nSend *HELP* to see available commands.',
      'Admin reply'
    )

    return
  }

  const orderNumber = parts[1]

  if (!orderNumber) {
    await sendAndLog(
      from,
      '⚠️ Please provide an order number.\n\nExample:\nCONFIRM WT-123456',
      'Admin reply'
    )

    return
  }

  let deliveryPhone = ''

  if (command === 'DISPATCH') {
    deliveryPhone = cleanPhone(parts[2] || '')

    if (!deliveryPhone) {
      await sendAndLog(
        from,
        '⚠️ Please provide the delivery person number.\n\nExample:\nDISPATCH WT-123456 03001234567',
        'Admin reply'
      )

      return
    }
  }

  try {
    const order = await findOrder(orderNumber)

    if (!order) {
      await sendAndLog(
        from,
        `❌ Order ${orderNumber} was not found.`,
        'Admin reply'
      )

      return
    }

    const currentStatus = String(
      order.order_status || ''
    ).toLowerCase()

    const targetStatus = command === 'CONFIRM'
      ? 'confirmed'
      : command === 'CANCEL'
        ? 'cancelled'
        : null

    // Prevent duplicate customer notifications.
    if (targetStatus && currentStatus === targetStatus) {
      await sendAndLog(
        from,
        `ℹ️ Order ${orderNumber} already has status *${targetStatus.toUpperCase()}*. No duplicate customer notification was sent.`,
        'Admin reply'
      )

      return
    }

    let updateData = {}

    if (command === 'CONFIRM') {
      updateData = {
        order_status: 'confirmed'
      }
    }

    if (command === 'CANCEL') {
      updateData = {
        order_status: 'cancelled'
      }
    }

    if (command === 'DISPATCH') {
      updateData = {
        order_status: 'shipped',
        delivery_person_phone: deliveryPhone,
        dispatched_at: new Date().toISOString()
      }
    }

    let updateQuery = supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id)

    // Compare current status to avoid concurrent duplicate updates.
    if (targetStatus) {
      if (order.order_status == null) {
        updateQuery = updateQuery.is('order_status', null)
      } else {
        updateQuery = updateQuery.eq(
          'order_status',
          order.order_status
        )
      }
    }

    const { data: updatedOrder, error } = await updateQuery
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Order update error:', error)

      await sendAndLog(
        from,
        `❌ Could not update order: ${error.message}`,
        'Admin reply'
      )

      return
    }

    if (!updatedOrder) {
      await sendAndLog(
        from,
        `⚠️ Order ${orderNumber} was changed by another request. Please check its current status.`,
        'Admin reply'
      )

      return
    }

    await sendAndLog(
      from,
      [
        '✅ *ORDER UPDATED SUCCESSFULLY*',
        '━━━━━━━━━━━━━━━━━━',
        '',
        `Order ID: ${orderNumber}`,
        `Action: ${command}`,
        `New Status: ${updateData.order_status.toUpperCase()}`,
        '',
        'LapMob Accessories'
      ].join('\n'),
      'Admin confirmation'
    )

    const customerPhone = getCustomerPhone(order)

    if (
      (command === 'CONFIRM' || command === 'CANCEL') &&
      customerPhone
    ) {
      const customerMessage = getCustomerStatusMessage(
        orderNumber,
        targetStatus
      )

      const sent = await sendAndLog(
        customerPhone,
        customerMessage,
        targetStatus === 'confirmed'
          ? 'Customer confirmation'
          : 'Customer cancellation'
      )

      if (!sent) {
        await sendAndLog(
          from,
          `⚠️ Order ${orderNumber} was updated, but the customer WhatsApp notification failed.`,
          'Admin notification warning'
        )
      }
    } else if (
      (command === 'CONFIRM' || command === 'CANCEL') &&
      !customerPhone
    ) {
      await sendAndLog(
        from,
        `⚠️ Order ${orderNumber} was updated, but its customer phone number is missing.`,
        'Admin notification warning'
      )
    }

    if (command === 'DISPATCH') {
      await sendAndLog(
        deliveryPhone,
        [
          '📦 *LAPMOB DELIVERY ASSIGNMENT*',
          '━━━━━━━━━━━━━━━━━━',
          '',
          `Order ID: ${orderNumber}`,
          `Customer: ${order.customer_name || 'N/A'}`,
          `Customer Phone: ${customerPhone || 'N/A'}`,
          '',
          'Please proceed with the delivery.',
          '',
          'LapMob Accessories'
        ].join('\n'),
        'Delivery assignment'
      )

      if (customerPhone) {
        await sendAndLog(
          customerPhone,
          [
            '🚚 *YOUR ORDER IS ON THE WAY!*',
            '',
            `Your LapMob order *${orderNumber}* has been dispatched.`,
            '',
            'Thank you for shopping with LapMob Accessories!'
          ].join('\n'),
          'Customer dispatch notification'
        )
      }
    }
  } catch (error) {
    console.error('Admin command error:', error)

    await sendAndLog(
      from,
      `❌ Command failed: ${error.message}`,
      'Admin error reply'
    )
  }
}

// --------------------------------------------------
// 7. INCOMING WHATSAPP WEBHOOK
// --------------------------------------------------

async function handleIncomingWebhook(payload) {
  const entries = payload?.entry || []

  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {}

      for (const incoming of value?.messages || []) {
        const from = cleanPhone(incoming.from || '')

        const message =
          incoming?.text?.body ||
          incoming?.button?.text ||
          ''

        if (!from || !message) continue

        const messageId = incoming?.id || null

        console.log('Incoming WhatsApp message:', {
          from,
          message
        })

        await saveWhatsAppMessage({
          phone: from,
          direction: 'inbound',
          message,
          messageId
        })

        await handleAdminCommand(from, message)
      }
    }
  }
}

// --------------------------------------------------
// 8. MAIN SERVER
// --------------------------------------------------

async function handler(req, res) {
  setCors(req, res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(
    req.url,
    `http://${req.headers.host || 'localhost'}`
  )

  if (url.pathname === '/webhook') {
    console.log('WEBHOOK REQUEST RECEIVED:', {
      method: req.method,
      signaturePresent: Boolean(req.headers['x-hub-signature-256'])
    })
  }

  try {
    // ------------------------------------------------
    // HEALTH CHECK
    // ------------------------------------------------

    if (
      req.method === 'GET' &&
      url.pathname === '/api/health'
    ) {
      sendJson(res, 200, {
        ok: true,
        configured: missing.length === 0,
        missing,
        service: 'LapMob WhatsApp Service'
      })

      return
    }

    // ------------------------------------------------
    // ORDER CREATED: AUTHENTICATE CUSTOMER AND NOTIFY ADMIN
    // ------------------------------------------------

    if (
      req.method === 'POST' &&
      url.pathname === '/api/order-created'
    ) {
      if (!supabase) {
        sendJson(res, 503, {
          error: 'Supabase is not configured'
        })

        return
      }

      const authorization = req.headers.authorization || ''

      const token = authorization
        .replace(/^Bearer\s+/i, '')
        .trim()

      if (!token) {
        sendJson(res, 401, {
          error: 'Authentication required'
        })

        return
      }

      let payload

      try {
        payload = await readRequestJson(req)
      } catch {
        sendJson(res, 400, {
          error: 'Invalid JSON request'
        })

        return
      }

      const orderId = String(
        payload?.order_id || ''
      ).trim()

      const orderNumber = String(
        payload?.order_number || ''
      ).trim()

      if (!orderId && !orderNumber) {
        sendJson(res, 400, {
          error: 'order_id or order_number is required'
        })

        return
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser(token)

      if (authError || !authData?.user) {
        console.error(
          'Customer authentication failed:',
          authError
        )

        sendJson(res, 401, {
          error: 'Invalid session'
        })

        return
      }

      const authenticatedUserId = String(authData.user.id)

      let order = null
      let orderError = null

      if (orderId) {
        const result = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle()

        order = result.data
        orderError = result.error
      }

      if (!order && orderNumber) {
        console.log(
          'Order ID lookup did not find order. Trying order_number:',
          orderNumber
        )

        const fallbackResult = await supabase
          .from('orders')
          .select('*')
          .eq('order_number', orderNumber)
          .maybeSingle()

        if (fallbackResult.error) {
          orderError = fallbackResult.error
        } else {
          order = fallbackResult.data
          orderError = null
        }
      }

      const orderUserId = String(order?.user_id || '')

      console.log('Order notification check:', {
        orderId,
        orderNumber,
        authenticatedUserId,
        orderUserId,
        orderFound: Boolean(order),
        databaseError: orderError?.message || null,
        databaseErrorCode: orderError?.code || null
      })

      if (orderError) {
        sendJson(res, 500, {
          error: 'Could not read order from database',
          details: orderError.message,
          code: orderError.code
        })

        return
      }

      if (!order) {
        sendJson(res, 404, {
          error: 'Order not found in backend database',
          orderId,
          orderNumber
        })

        return
      }

      if (orderUserId !== authenticatedUserId) {
        console.error('Order ownership verification failed.')

        sendJson(res, 403, {
          error: 'Order access denied'
        })

        return
      }

      const message = formatOrderMessage(order)

      const sent = await sendAndLog(
        ADMIN_WHATSAPP_NUMBER,
        message,
        'LapMob admin order alert'
      )

      if (!sent) {
        sendJson(res, 502, {
          ok: false,
          error: 'Order found, but WhatsApp admin notification failed'
        })

        return
      }

      sendJson(res, 200, {
        ok: true,
        message: 'Order verified and admin WhatsApp notification accepted',
        order_number: order.order_number
      })

      return
    }

    // ------------------------------------------------
    // ADMIN ORDER STATUS UPDATE + CUSTOMER WHATSAPP
    // ------------------------------------------------

    if (
      req.method === 'POST' &&
      url.pathname === '/api/admin/order-status'
    ) {
      if (!supabase) {
        sendJson(res, 503, {
          error: 'Supabase is not configured'
        })

        return
      }

      const authorization = req.headers.authorization || ''

      const token = authorization
        .replace(/^Bearer\s+/i, '')
        .trim()

      if (!token) {
        sendJson(res, 401, {
          error: 'Authentication required'
        })

        return
      }

      let payload

      try {
        payload = await readRequestJson(req)
      } catch {
        sendJson(res, 400, {
          error: 'Invalid JSON request'
        })

        return
      }

      const orderId = String(
        payload?.order_id || ''
      ).trim()

      const newStatus = String(
        payload?.status || ''
      ).trim().toLowerCase()

      if (
        !orderId ||
        !['confirmed', 'cancelled'].includes(newStatus)
      ) {
        sendJson(res, 400, {
          error: 'Valid order_id and status are required'
        })

        return
      }

      // Verify Supabase user session.
      const { data: authData, error: authError } =
        await supabase.auth.getUser(token)

      if (authError || !authData?.user) {
        sendJson(res, 401, {
          error: 'Invalid session'
        })

        return
      }

      // Verify admin role.
      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single()

      if (profileError || profile?.role !== 'admin') {
        sendJson(res, 403, {
          error: 'Admin access required'
        })

        return
      }

      // Read order.
      const { data: order, error: orderError } =
        await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle()

      if (orderError) {
        sendJson(res, 500, {
          error: 'Could not read order',
          details: orderError.message
        })

        return
      }

      if (!order) {
        sendJson(res, 404, {
          error: 'Order not found'
        })

        return
      }

      const currentStatus = String(
        order.order_status || ''
      ).toLowerCase()

      // Do not send another notification for the same status.
      if (currentStatus === newStatus) {
        sendJson(res, 200, {
          ok: true,
          alreadyUpdated: true,
          notificationSent: false,
          order_number: getOrderNumber(order),
          message: 'Order already has this status. No duplicate notification sent.'
        })

        return
      }

      // Update only if the status has not changed since it was read.
      let updateQuery = supabase
        .from('orders')
        .update({
          order_status: newStatus
        })
        .eq('id', orderId)

      if (order.order_status == null) {
        updateQuery = updateQuery.is('order_status', null)
      } else {
        updateQuery = updateQuery.eq(
          'order_status',
          order.order_status
        )
      }

      const { data: updatedOrder, error: updateError } =
        await updateQuery
          .select('id')
          .maybeSingle()

      if (updateError) {
        sendJson(res, 500, {
          error: 'Could not update order',
          details: updateError.message
        })

        return
      }

      if (!updatedOrder) {
        sendJson(res, 409, {
          error: 'Order status changed by another request. Refresh dashboard.'
        })

        return
      }

      const orderNumber = getOrderNumber(order)
      const customerPhone = getCustomerPhone(order)

      if (!customerPhone) {
        sendJson(res, 200, {
          ok: true,
          notificationSent: false,
          order_number: orderNumber,
          message: 'Order updated, but customer phone number is missing.'
        })

        return
      }

      const customerMessage = getCustomerStatusMessage(
        orderNumber,
        newStatus
      )

      const sent = await sendAndLog(
        customerPhone,
        customerMessage,
        newStatus === 'confirmed'
          ? 'Dashboard customer confirmation'
          : 'Dashboard customer cancellation'
      )

      sendJson(res, sent ? 200 : 502, {
        ok: true,
        notificationSent: sent,
        order_number: orderNumber,
        message: sent
          ? 'Order updated and customer WhatsApp notification accepted.'
          : 'Order updated, but WhatsApp notification failed.'
      })

      return
    }

    // ------------------------------------------------
    // META WEBHOOK VERIFICATION (GET)
    // ------------------------------------------------

    if (
      req.method === 'GET' &&
      url.pathname === '/webhook'
    ) {
      const mode = url.searchParams.get('hub.mode')

      const verifyToken =
        url.searchParams.get('hub.verify_token')

      const challenge =
        url.searchParams.get('hub.challenge')

      if (
        mode === 'subscribe' &&
        verifyToken === META_VERIFY_TOKEN &&
        challenge
      ) {
        res.writeHead(200, {
          'Content-Type': 'text/plain'
        })

        res.end(challenge)
        return
      }

      sendJson(res, 403, {
        error: 'Webhook verification failed'
      })

      return
    }

    // ------------------------------------------------
    // META WEBHOOK EVENTS (POST)
    // ------------------------------------------------

    if (
      req.method === 'POST' &&
      url.pathname === '/webhook'
    ) {
      const rawBody = await readRawBody(req)

      const signature =
        req.headers['x-hub-signature-256']

      if (!verifyMetaSignature(rawBody, signature)) {
        console.error(
          'Webhook signature verification failed'
        )

        sendJson(res, 401, {
          error: 'Invalid webhook signature'
        })

        return
      }

      let payload

      try {
        payload = JSON.parse(rawBody.toString('utf8'))
      } catch {
        sendJson(res, 400, {
          error: 'Invalid webhook JSON'
        })

        return
      }

            // Process incoming WhatsApp messages before responding.
      try {
        await handleIncomingWebhook(payload)
        sendJson(res, 200, {
          ok: true,
          received: true,
          processed: true
        })
      } catch (error) {
        console.error('Webhook processing error:', error)
        sendJson(res, 500, {
          ok: false,
          error: 'Webhook processing failed'
        })
      }

      return
    }

    // ------------------------------------------------
    // UNKNOWN ROUTE
    // ------------------------------------------------

    sendJson(res, 404, {
      error: 'Route not found'
    })
  } catch (error) {
    console.error('Server request error:', error)

    sendJson(res, 500, {
      error: 'Internal server error'
    })
  }
}

export default handler

// Local development server only.
if (!process.env.VERCEL) {
  const server = http.createServer(handler)

  server.listen(PORT, () => {
    console.log(`LapMob WhatsApp service listening on port ${PORT}; missing config: ${missing.length ? missing.join(String.fromCharCode(44,32)) : String.fromCharCode(110,111,110,101)}`)
  })

  server.on(String.fromCharCode(101,114,114,111,114), error => {
    console.error(`Server startup error: ${error}`)
  })
}
