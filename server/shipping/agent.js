
let running = false
let started = false

const reportedInvalidOrders = new Set()

const AGENT_RULE_NAME = 'shipping_agent_enabled'

export async function getShippingAgentControl(supabase) {
  const { data, error } = await supabase
    .from('shipping_agent_rules')
    .select('*')
    .eq('rule_name', AGENT_RULE_NAME)
    .maybeSingle()

  if (error) throw error

  return {
    enabled: data ? data.is_enabled === true : true,
    rule: data || null
  }
}

export async function setShippingAgentControl(supabase, enabled) {
  const { data: existing, error: findError } = await supabase
    .from('shipping_agent_rules')
    .select('id')
    .eq('rule_name', AGENT_RULE_NAME)
    .maybeSingle()

  if (findError) throw findError

  const payload = {
    rule_name: AGENT_RULE_NAME,
    rule_type: 'agent_control',
    rule_config: { enabled: Boolean(enabled) },
    is_enabled: Boolean(enabled),
    updated_at: new Date().toISOString()
  }

  const result = existing
    ? await supabase.from('shipping_agent_rules').update(payload).eq('id', existing.id)
    : await supabase.from('shipping_agent_rules').insert(payload)

  if (result.error) throw result.error

  return { enabled: Boolean(enabled) }
}


function normalizePakistanPhone(value) {
  let phone = String(value || '').trim().replace(/[\s()-]/g, '')

  if (/^03\d{9}$/.test(phone)) {
    phone = `+92${phone.slice(1)}`
  } else if (/^92\d{10}$/.test(phone)) {
    phone = `+${phone}`
  }

  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null

  return phone
}

async function logAgent(
  supabase,
  action,
  details,
  shipmentId = null,
  result = 'success'
) {
  const { error } = await supabase
    .from('shipping_agent_logs')
    .insert({
      shipment_id: shipmentId,
      action,
      details: details || {},
      result
    })

  if (error) {
    console.error('Shipping Agent log error:', error.message)
  }
}

export async function runShippingAgent({ supabase, sendAndLog }) {
  if (running || !supabase) return

  running = true

  try {
    const control = await getShippingAgentControl(supabase)

    if (!control.enabled) {
      console.log('LapMob Shipping Agent is disabled.')
      return
    }
    // Process recent orders only, avoiding an uncontrolled
    // backlog of historical orders after installation.
    const lookback = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [orderResult, shipmentResult, courierResult] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .in('order_status', ['confirmed', 'processing'])
        .gte('created_at', lookback)
        .order('created_at', { ascending: true })
        .limit(100),

      supabase
        .from('shipments')
        .select('order_id,status'),

      supabase
        .from('shipping_couriers')
        .select('courier_code,courier_name,is_active,integration_mode')
        .eq('is_active', true)
        .order('courier_name')
    ])

    if (orderResult.error) throw orderResult.error
    if (shipmentResult.error) throw shipmentResult.error
    if (courierResult.error) throw courierResult.error

    const orders = orderResult.data || []
    const shipments = shipmentResult.data || []
    const couriers = courierResult.data || []

    for (const order of orders) {
      const orderId = String(order.id || '').trim()
      if (!orderId) continue

      // Never automatically create a second shipment for an order,
      // regardless of its existing shipment status.
      const existing = shipments.some(
        item => String(item.order_id) === orderId
      )

      if (existing) continue

      const rawPhone =
        order.customer_phone ||
        order.phone ||
        order.shipping_phone ||
        ''

      const phone = normalizePakistanPhone(rawPhone)

      const address = String(
        order.shipping_address ||
        order.delivery_address ||
        ''
      ).trim()

      if (!phone || !address) {
        if (!reportedInvalidOrders.has(orderId)) {
          await logAgent(
            supabase,
            'order_needs_shipping_details',
            {
              order_id: orderId,
              phone_invalid: !phone,
              address_missing: !address
            },
            null,
            'warning'
          )

          reportedInvalidOrders.add(orderId)
        }

        continue
      }

      const courier = couriers[0] || null
      const courierCode = courier?.courier_code || null

      const paymentMethod = String(
        order.payment_method ||
        order.payment_type ||
        ''
      ).toLowerCase()

      const total = Math.max(0, Number(order.total_amount) || 0)

      const shipmentPayload = {
        order_id: orderId,
        order_number: String(order.order_number || '').trim() || null,
        customer_name: String(order.customer_name || '').trim() || null,
        customer_phone: phone,
        delivery_address: address,
        city: String(
          order.shipping_city || order.city || ''
        ).trim() || null,
        courier_code: courierCode,
        service_type: null,
        cod_amount: paymentMethod === 'cod' ? total : 0,
        shipping_cost: 0,
        status: 'pending',
        booking_mode: 'manual'
      }

      const { data: shipment, error: insertError } = await supabase
        .from('shipments')
        .insert(shipmentPayload)
        .select()
        .single()

      if (insertError) {
        await logAgent(
          supabase,
          'shipment_auto_prepare_failed',
          {
            order_id: orderId,
            error: insertError.message
          },
          null,
          'failed'
        )

        continue
      }

      shipments.push({
        order_id: orderId,
        status: 'pending'
      })

      await supabase.from('shipment_tracking').insert({
        shipment_id: shipment.id,
        status: 'pending',
        description: 'Automatically prepared by LapMob Shipping Agent'
      })

      await logAgent(
        supabase,
        'shipment_auto_prepared',
        {
          order_id: orderId,
          courier_code: courierCode,
          booking_mode: 'manual'
        },
        shipment.id
      )

      if (typeof sendAndLog === 'function') {
        try {
          const orderLabel = order.order_number || orderId

          const sent = await sendAndLog(
            phone,
            `LapMob update: Your shipment for order ${orderLabel} has been prepared. Current status: Pending.`,
            'Shipping Agent'
          )

          if (sent === false) {
            await logAgent(
              supabase,
              'whatsapp_notification_failed',
              { order_id: orderId, reason: 'WhatsApp provider rejected the message' },
              shipment.id,
              'failed'
            )
          }
        } catch (notificationError) {
          console.error(
            'Shipping WhatsApp notification failed:',
            notificationError.message
          )

          await logAgent(
            supabase,
            'whatsapp_notification_failed',
            {
              order_id: orderId,
              error: notificationError.message
            },
            shipment.id,
            'failed'
          )
        }
      }

      if (!courier) {
        await logAgent(
          supabase,
          'no_active_courier',
          {
            order_id: orderId,
            message: 'Activate a courier in Shipping Management.'
          },
          shipment.id,
          'warning'
        )
      }

      console.log(
        'LapMob Shipping Agent prepared shipment:',
        orderId
      )
    }
  } catch (error) {
    console.error('LapMob Shipping Agent failed:', error.message)
  } finally {
    running = false
  }
}

export function startShippingAgent({ supabase, sendAndLog }) {
  if (started || !supabase) return

  started = true

  console.log(
    'LapMob Shipping Agent started; interval: 60 seconds'
  )

  setTimeout(() => {
    runShippingAgent({ supabase, sendAndLog })
  }, 10000)

  const timer = setInterval(() => {
    runShippingAgent({ supabase, sendAndLog })
  }, 60000)

  timer.unref?.()
}

