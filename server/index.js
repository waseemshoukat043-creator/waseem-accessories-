
import http from 'node:http'
import { handleShippingRequest } from './shipping/routes.js'
import { startShippingAgent } from './shipping/agent.js'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'

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

const EMAIL_USER = process.env.EMAIL_USER || ''
const EMAIL_APP_PASSWORD =
  process.env.EMAIL_APP_PASSWORD || ''
const EMAIL_FROM =
  process.env.EMAIL_FROM || EMAIL_USER

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
// 3. WHATSAPP MESSAGE HISTORY
// --------------------------------------------------

async function saveWhatsAppMessage({
  phone,
  direction,
  message,
  messageId = null
}) {
  if (!supabase) return

  const normalizedPhone = cleanPhone(phone)

  if (!normalizedPhone || !message) return

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
      console.error('WhatsApp history save failed:', error.message)
    }
  } catch (error) {
    console.error('WhatsApp history error:', error.message)
  }
}

// Check whether this WhatsApp message was already processed.
// Requires the existing whatsapp_messages.wa_message_id column.
async function wasMessageProcessed(messageId) {
  if (!supabase || !messageId) return false

  try {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('wa_message_id')
      .eq('wa_message_id', messageId)
      .limit(1)

    if (error) {
      console.error('WhatsApp duplicate check failed:', error.message)
      return false
    }

    return Boolean(data?.length)
  } catch (error) {
    console.error('WhatsApp duplicate check error:', error.message)
    return false
  }
}

// --------------------------------------------------
// 4. HTTP HELPERS
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
  const origin = req.headers.origin || ''

  const allowedOrigins = new Set([
    CLIENT_ORIGIN,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
    'http://localhost:5176',
    'http://127.0.0.1:5176'
  ].filter(Boolean))

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else if (!origin && CLIENT_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', CLIENT_ORIGIN)
  }

  res.setHeader('Vary', 'Origin')

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, PUT, DELETE, OPTIONS'
  )

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Hub-Signature-256'
  )

  res.setHeader('Access-Control-Max-Age', '86400')
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
// 5. WHATSAPP SEND MESSAGE
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
// 6. ORDER HELPERS
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || '').trim()
  )
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function sendConfirmationEmail(order) {
  let recipient = String(order?.customer_email || '').trim()
  const orderNumber = getOrderNumber(order)

  if (!recipient && order?.user_id) {
    try {
      const { data: userData } = await supabase.auth.admin
        .getUserById(order.user_id)
      recipient = String(userData?.user?.email || '').trim()
    } catch (error) {
      console.error('Customer email lookup failed:', error.message)
    }
  }

  if (!recipient) {
    return { status: 'failed', sent: false, error: 'Customer email missing' }
  }

  if (!isValidEmail(recipient)) {
    return { status: 'failed', sent: false, error: 'Invalid customer email' }
  }

  const notificationType = 'order_confirmed'

  const { data: existingNotification, error: lookupError } =
    await supabase
      .from('email_notifications')
      .select('status')
      .eq('order_id', order.id)
      .eq('notification_type', notificationType)
      .maybeSingle()

  if (lookupError) {
    console.error('Email notification lookup failed:', lookupError.message)
    return { status: 'failed', sent: false, error: lookupError.message }
  }

  if (
    existingNotification?.status === 'sent' ||
    existingNotification?.status === 'pending'
  ) {
    return {
      status: existingNotification.status,
      sent: existingNotification.status === 'sent',
      skipped: true
    }
  }

  let insertError = null

  if (existingNotification?.status === 'failed') {
    const retryResult = await supabase
      .from('email_notifications')
      .update({
        recipient_email: recipient,
        status: 'pending',
        provider_message_id: null,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', order.id)
      .eq('notification_type', notificationType)
    insertError = retryResult.error
  } else {
    const insertResult = await supabase
      .from('email_notifications')
      .insert({
        order_id: order.id,
        notification_type: notificationType,
        recipient_email: recipient,
        status: 'pending'
      })
    insertError = insertResult.error
  }

  if (insertError) {
    if (insertError.code !== '23505') {
      console.error('Email notification insert failed:', insertError.message)
    }
    return { status: 'failed', sent: false, error: insertError.message }
  }

  async function recordEmailFailure(errorMessage) {
    await supabase
      .from('email_notifications')
      .update({
        status: 'failed',
        error_message: String(errorMessage).slice(0, 2000),
        updated_at: new Date().toISOString()
      })
      .eq('order_id', order.id)
      .eq('notification_type', notificationType)
  }

  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    await recordEmailFailure('Email SMTP configuration missing')
    return {
      status: 'failed',
      sent: false,
      error: 'Email SMTP configuration missing'
    }
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from('order_items')
    .select('product_name, quantity, unit_price, line_total')
    .eq('order_id', order.id)
    .order('id')

  if (itemsError) {
    await recordEmailFailure(itemsError.message)
    return { status: 'failed', sent: false, error: itemsError.message }
  }

  const items = itemRows || []
  const itemRowsHtml = items.length
    ? items.map(item => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(item.product_name)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${escapeHtml(item.quantity)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">PKR ${escapeHtml(formatPKR(item.line_total ?? item.unit_price * item.quantity))}</td>
      </tr>`).join('')
    : '<tr><td colspan="3" style="padding:10px;border-bottom:1px solid #eee;">Order items unavailable</td></tr>'

  const total = formatPKR(order.total_amount ?? order.subtotal)
  const paymentMethod = String(order.payment_method || 'Not provided')
    .replaceAll('_', ' ')
    .toUpperCase()
  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Not available'

  const html = `
    <div style="margin:0;padding:24px;background:#f8f9f6;font-family:Arial,sans-serif;color:#24212B;">
      <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee;">
        <div style="background:#5B3A8E;padding:24px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;">LapMob Accessories</h1>
        </div>
        <div style="padding:24px;">
          <p>Dear ${escapeHtml(order.customer_name || 'Customer')},</p>
          <p>Your order has been <strong>confirmed</strong>. Thank you for shopping with LapMob Accessories.</p>
          <p><strong>Order number:</strong> ${escapeHtml(orderNumber)}<br>
          <strong>Order date:</strong> ${escapeHtml(orderDate)}<br>
          <strong>Payment method:</strong> ${escapeHtml(paymentMethod)}<br>
          <strong>Status:</strong> CONFIRMED</p>
          <table style="width:100%;border-collapse:collapse;margin-top:20px;">
            <thead>
              <tr>
                <th style="padding:10px;text-align:left;background:#ede5f7;">Product</th>
                <th style="padding:10px;text-align:center;background:#ede5f7;">Qty</th>
                <th style="padding:10px;text-align:right;background:#ede5f7;">Amount</th>
              </tr>
            </thead>
            <tbody>${itemRowsHtml}</tbody>
          </table>
          <p style="text-align:right;font-size:18px;margin-top:20px;"><strong>Order total: PKR ${escapeHtml(total)}</strong></p>
          <p>We appreciate your order and look forward to serving you.</p>
        </div>
      </div>
    </div>`

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_APP_PASSWORD
      }
    })

    const result = await transporter.sendMail({
      from: EMAIL_FROM,
      to: recipient,
      subject: `LapMob Order Confirmed - ${orderNumber}`,
      text: `Dear ${order.customer_name || 'Customer'}, your LapMob order ${orderNumber} has been confirmed. Order total: PKR ${total}. Payment method: ${paymentMethod}. Thank you for shopping with LapMob Accessories.`,
      html
    })

    await supabase
      .from('email_notifications')
      .update({
        status: 'sent',
        provider_message_id: result.messageId || null,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', order.id)
      .eq('notification_type', notificationType)

    return {
      status: 'sent',
      sent: true,
      providerMessageId: result.messageId || null
    }
  } catch (error) {
    await recordEmailFailure(error.message)
    console.error('Confirmation email delivery failed:', error.message)
    return { status: 'failed', sent: false, error: error.message }
  }
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
    `• Status: ${status}`,
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
    'HELP',
    `CONFIRM ${orderNumber}`,
    `CANCEL ${orderNumber}`,
    `DISPATCH ${orderNumber} 03XXXXXXXXX`,
    `DELIVERED ${orderNumber}`,
    `STATUS ${orderNumber}`,
    '',
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

  if (status === 'shipped') {
    return [
      '🚚 *YOUR ORDER IS ON THE WAY!*',
      '',
      `Your LapMob order *${orderNumber}* has been dispatched.`,
      '',
      'Thank you for shopping with LapMob Accessories!'
    ].join('\n')
  }

  if (status === 'delivered') {
    return [
      '📦 *ORDER DELIVERED*',
      '',
      `Your LapMob order *${orderNumber}* has been marked as delivered.`,
      '',
      'Thank you for choosing LapMob Accessories!'
    ].join('\n')
  }

  return `Your LapMob order *${orderNumber}* status is *${String(status || 'pending').toUpperCase()}*.`
}

// --------------------------------------------------
// 7. CUSTOMER ORDER LOOKUP
// --------------------------------------------------

// Customer can only see an order whose stored phone matches
// the WhatsApp sender number.
async function findCustomerOrders(phone) {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const normalizedPhone = cleanPhone(phone)

  if (!normalizedPhone) return []

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .limit(500)

  if (error) {
    console.error('Customer order lookup error:', error)
    throw error
  }

  return (data || [])
    .filter(order => getCustomerPhone(order) === normalizedPhone)
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return dateB - dateA
    })
}

async function handleCustomerMessage(from, message) {
  const normalizedMessage = String(message || '').trim()
  const command = normalizedMessage.toUpperCase()
  let reply = ''

  if (
    ['HI', 'HELLO', 'HEY', 'AOA', 'ASSALAM O ALAIKUM'].includes(command)
  ) {
    reply = [
      '👋 *Welcome to LapMob Accessories!*',
      '',
      'How can we help you today?',
      '',
      'Send *HELP* to see available options.'
    ].join('\n')
  } else if (command === 'HELP') {
    reply = [
      '📱 *LAPMOB CUSTOMER HELP*',
      '━━━━━━━━━━━━━━━━━━',
      '',
      '🔹 HI - Welcome message',
      '🔹 STATUS - Check your latest order',
      '🔹 STATUS ORDER_NUMBER - Check a specific order',
      '🔹 DELIVERY - Delivery information',
      '🔹 PRICE - Product price enquiry',
      '',
      'You can also send your product name or question.',
      '',
      '*LapMob Accessories*'
    ].join('\n')
  } else if (command === 'STATUS' || command.startsWith('STATUS ')) {
    try {
      const requestedOrderNumber = normalizedMessage
        .split(/\s+/)
        .slice(1)
        .join(' ')
        .trim()

      if (requestedOrderNumber) {
        const order = await findOrder(requestedOrderNumber)

        if (!order || getCustomerPhone(order) !== cleanPhone(from)) {
          reply = '❌ We could not find that order for your WhatsApp number.'
        } else {
          reply = getCustomerStatusMessage(
            getOrderNumber(order),
            order.order_status || 'pending'
          )
        }
      } else {
        const orders = await findCustomerOrders(from)
        const order = orders[0]

        if (!order) {
          reply = 'We could not find an order linked to this WhatsApp number.'
        } else {
          reply = getCustomerStatusMessage(
            getOrderNumber(order),
            order.order_status || 'pending'
          )
        }
      }
    } catch (error) {
      console.error('Customer status command failed:', error)
      reply = 'Sorry, we could not check your order right now. Please try again later.'
    }
  } else if (command === 'DELIVERY') {
    reply = [
      '🚚 *LAPMOB DELIVERY INFORMATION*',
      '',
      'For a delivery update, send:',
      '*STATUS*',
      '',
      'You can also send your order number to our support team.'
    ].join('\n')
  } else if (command === 'PRICE') {
    reply = [
      '💰 *PRODUCT PRICE ENQUIRY*',
      '',
      'Please send the product name, product link, or product image.',
      'Our team will help you with the latest price.'
    ].join('\n')
  } else {
    reply = [
      'Thank you for contacting *LapMob Accessories*.',
      '',
      'Our team will assist you shortly.',
      'Send *HELP* to see available options.'
    ].join('\n')
  }

  await sendAndLog(from, reply, 'Customer auto-reply')
}

// --------------------------------------------------
// 8. ADMIN WHATSAPP COMMANDS
// --------------------------------------------------

async function handleAdminCommand(from, message) {
  if (from !== ADMIN_WHATSAPP_NUMBER) {
    console.log('Unauthorized WhatsApp command ignored:', from)
    return
  }

  const parts = String(message || '').trim().split(/\s+/)
  const command = (parts[0] || '').toUpperCase()

  if (command === 'HELP') {
    await sendAndLog(
      from,
      [
        '📱 *LAPMOB ADMIN COMMANDS*',
        '━━━━━━━━━━━━━━━━━━',
        '',
        'HELP',
        'CONFIRM ORDER_NUMBER',
        'CANCEL ORDER_NUMBER',
        'DISPATCH ORDER_NUMBER 03XXXXXXXXX',
        'DELIVERED ORDER_NUMBER',
        'STATUS ORDER_NUMBER',
        '',
        'Example:',
        'CONFIRM WT-123456',
        'DISPATCH WT-123456 03001234567',
        'DELIVERED WT-123456',
        'STATUS WT-123456',
        '',
        '*LapMob Accessories*'
      ].join('\n'),
      'Admin help'
    )

    return
  }

  const supportedCommands = [
    'CONFIRM',
    'CANCEL',
    'DISPATCH',
    'DELIVERED',
    'STATUS'
  ]

  if (!supportedCommands.includes(command)) {
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
      `⚠️ Please provide an order number.\n\nExample:\n${command} WT-123456`,
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
      order.order_status || 'pending'
    ).toLowerCase()

    // STATUS only reads the order. It does not update it.
    if (command === 'STATUS') {
      await sendAndLog(
        from,
        [
          '📦 *ORDER STATUS*',
          '━━━━━━━━━━━━━━━━━━',
          '',
          `Order: ${getOrderNumber(order)}`,
          `Customer: ${order.customer_name || 'N/A'}`,
          `Customer phone: ${getCustomerPhone(order) || 'N/A'}`,
          `Payment: ${order.payment_method || 'N/A'}`,
          `Total: PKR ${formatPKR(order.total_amount ?? order.total)}`,
          `Status: *${currentStatus.toUpperCase()}*`,
          '',
          '*LapMob Accessories*'
        ].join('\n'),
        'Admin order status'
      )
      return
    }

    const targetStatus = {
      CONFIRM: 'confirmed',
      CANCEL: 'cancelled',
      DISPATCH: 'shipped',
      DELIVERED: 'delivered'
    }[command]

    if (currentStatus === targetStatus) {
      await sendAndLog(
        from,
        `ℹ️ Order ${orderNumber} already has status *${targetStatus.toUpperCase()}*. No duplicate customer notification was sent.`,
        'Admin reply'
      )
      return
    }

    if (currentStatus === 'cancelled' && command !== 'CANCEL') {
      await sendAndLog(
        from,
        `⚠️ Order ${orderNumber} is cancelled. It cannot be changed using this command.`,
        'Admin reply'
      )
      return
    }

    const updateData = {
      order_status: targetStatus
    }

    if (command === 'DISPATCH') {
      updateData.delivery_person_phone = deliveryPhone
      updateData.dispatched_at = new Date().toISOString()
    }

    let updateQuery = supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id)

    // Avoid overwriting a status changed by another request.
    if (order.order_status == null) {
      updateQuery = updateQuery.is('order_status', null)
    } else {
      updateQuery = updateQuery.eq(
        'order_status',
        order.order_status
      )
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
        `⚠️ Order ${orderNumber} was changed by another request. Send STATUS ${orderNumber} to check its current status.`,
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
        `New Status: ${targetStatus.toUpperCase()}`,
        '',
        'LapMob Accessories'
      ].join('\n'),
      'Admin confirmation'
    )

    if (targetStatus === 'confirmed') {
      const emailResult = await sendConfirmationEmail({
        ...order,
        order_status: 'confirmed'
      })

      if (emailResult.sent) {
        await sendAndLog(
          from,
          `✅ Confirmation email sent for order ${orderNumber}.`,
          'Admin email confirmation'
        )
      } else if (!emailResult.skipped) {
        await sendAndLog(
          from,
          `⚠️ Order ${orderNumber} was confirmed, but the confirmation email was not sent.`,
          'Admin email warning'
        )
      }
    }

    const customerPhone = getCustomerPhone(order)

    if (customerPhone) {
      const customerMessage = getCustomerStatusMessage(
        orderNumber,
        targetStatus
      )

      const sent = await sendAndLog(
        customerPhone,
        customerMessage,
        `Customer ${targetStatus} notification`
      )

      if (!sent) {
        await sendAndLog(
          from,
          `⚠️ Order ${orderNumber} was updated, but the customer WhatsApp notification failed.`,
          'Admin notification warning'
        )
      }
    } else {
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
// 9. INCOMING WHATSAPP WEBHOOK
// --------------------------------------------------

async function handleIncomingWebhook(payload) {
  console.log('WEBHOOK PROCESSING STARTED')

  console.log(
    'WEBHOOK EVENT SUMMARY:',
    JSON.stringify(
      (payload?.entry || []).map(entry => ({
        changes: (entry?.changes || []).map(change => ({
          field: change?.field,
          hasMessages: Array.isArray(change?.value?.messages),
          messageCount: change?.value?.messages?.length || 0,
          hasStatuses: Array.isArray(change?.value?.statuses),
          statusCount: change?.value?.statuses?.length || 0
        }))
      }))
    )
  )

  const entries = payload?.entry || []

  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {}

      for (const incoming of value?.messages || []) {
        const from = cleanPhone(incoming.from || '')

        const message =
          incoming?.text?.body ||
          incoming?.button?.text ||
          incoming?.interactive?.button_reply?.title ||
          incoming?.interactive?.list_reply?.title ||
          ''

        if (!from || !message) continue

        const messageId = incoming?.id || null

        console.log('Incoming WhatsApp message:', {
          from,
          message,
          messageId
        })

        // Prevent repeated webhook deliveries from processing
        // the same message more than once.
        if (messageId && await wasMessageProcessed(messageId)) {
          console.log('Duplicate WhatsApp message ignored:', messageId)
          continue
        }

        // Save before processing so a retry can be detected.
        await saveWhatsAppMessage({
          phone: from,
          direction: 'inbound',
          message,
          messageId
        })

        if (from === ADMIN_WHATSAPP_NUMBER) {
          await handleAdminCommand(from, message)
        } else {
          await handleCustomerMessage(from, message)
        }
      }
    }
  }
}

// --------------------------------------------------
// 10. MAIN SERVER
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
    const shippingHandled = await handleShippingRequest(
      req,
      res,
      url,
      {
        supabase,
        readRequestJson,
        sendJson,
        sendAndLog
      }
    )

    if (shippingHandled) return

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

      const orderId = String(payload?.order_id || '').trim()
      const orderNumber = String(payload?.order_number || '').trim()
      const customerEmail = String(payload?.customer_email || '').trim()

      if (!orderId && !orderNumber) {
        sendJson(res, 400, {
          error: 'order_id or order_number is required'
        })
        return
      }

      if (!customerEmail || !isValidEmail(customerEmail)) {
        sendJson(res, 400, {
          error: 'A valid customer email is required'
        })
        return
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser(token)

      if (authError || !authData?.user) {
        console.error('Customer authentication failed:', authError)

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

      const { error: emailUpdateError } = await supabase
        .from('orders')
        .update({ customer_email: customerEmail })
        .eq('id', order.id)

      if (emailUpdateError) {
        sendJson(res, 500, {
          error: 'Order was created, but its customer email could not be saved',
          details: emailUpdateError.message
        })
        return
      }

      order.customer_email = customerEmail

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

      const orderId = String(payload?.order_id || '').trim()
      const newStatus = String(payload?.status || '')
        .trim()
        .toLowerCase()

      if (
        !orderId ||
        !['confirmed', 'cancelled'].includes(newStatus)
      ) {
        sendJson(res, 400, {
          error: 'Valid order_id and status are required'
        })
        return
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser(token)

      if (authError || !authData?.user) {
        sendJson(res, 401, {
          error: 'Invalid session'
        })
        return
      }

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
      let whatsappSent = false

      if (customerPhone) {
        const customerMessage = getCustomerStatusMessage(
          orderNumber,
          newStatus
        )

        whatsappSent = await sendAndLog(
          customerPhone,
          customerMessage,
          newStatus === 'confirmed'
            ? 'Dashboard customer confirmation'
            : 'Dashboard customer cancellation'
        )
      }

      let emailResult = null

      if (newStatus === 'confirmed') {
        emailResult = await sendConfirmationEmail({
          ...order,
          order_status: 'confirmed'
        })
      }

      const responseMessage = !customerPhone
        ? 'Order updated, but customer phone number is missing.'
        : whatsappSent
          ? 'Order updated and customer WhatsApp notification accepted.'
          : 'Order updated, but WhatsApp notification failed.'

      sendJson(res, whatsappSent || !customerPhone ? 200 : 502, {
        ok: true,
        notificationSent: whatsappSent,
        emailStatus: emailResult?.status || null,
        emailSent: emailResult?.sent === true,
        order_number: orderNumber,
        message: emailResult && !emailResult.sent
          ? `${responseMessage} Confirmation email was not sent.`
          : responseMessage
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
        console.error('Webhook signature verification failed')

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

// --------------------------------------------------
// 11. LOCAL DEVELOPMENT SERVER
// --------------------------------------------------

if (!process.env.VERCEL) {
  const server = http.createServer(handler)

  server.listen(PORT, () => {
    startShippingAgent({ supabase, sendAndLog })

    console.log(
      `LapMob WhatsApp service listening on port ${PORT}; missing config: ${
        missing.length
          ? missing.join(', ')
          : 'none'
      }`
    )
  })

  server.on('error', error => {
    console.error(`Server startup error: ${error}`)
  })
}
