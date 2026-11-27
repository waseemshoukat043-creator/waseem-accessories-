
import {
  getShippingAgentControl,
  setShippingAgentControl,
  runShippingAgent
} from './agent.js'

const ALLOWED_STATUSES = [
  'pending',
  'ready',
  'booked',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'returned',
  'cancelled'
]

async function authorizeAdmin(req, supabase) {
  const authorization = req.headers.authorization || ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return { error: 'Authentication required', status: 401 }
  }

  const { data: authData, error: authError } =
    await supabase.auth.getUser(token)

  if (authError || !authData?.user) {
    return { error: 'Invalid session', status: 401 }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return { error: 'Admin access required', status: 403 }
  }

  return { user: authData.user }
}

async function writeLog(supabase, action, details, shipmentId = null) {
  const { error } = await supabase
    .from('shipping_agent_logs')
    .insert({
      shipment_id: shipmentId,
      action,
      details: details || {},
      result: 'success'
    })

  if (error) {
    console.error('Shipping log error:', error.message)
  }
}

async function addTrackingEvent(
  supabase,
  shipmentId,
  status,
  description,
  location = null
) {
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('shipment_tracking')
    .insert({
      shipment_id: shipmentId,
      status,
      description,
      location,
      event_time: now,
      created_at: now
    })

  if (error) throw error
}

export async function handleShippingRequest(
  req,
  res,
  url,
  { supabase, readRequestJson, sendJson, sendAndLog }
) {
  if (!url.pathname.startsWith('/api/shipping/')) {
    return false
  }

  if (!supabase) {
    sendJson(res, 503, {
      error: 'Supabase is not configured'
    })
    return true
  }

  try {
    const auth = await authorizeAdmin(req, supabase)

    if (auth.error) {
      sendJson(res, auth.status, {
        error: auth.error
      })
      return true
    }

    // GET: Shipping Agent status
    if (
      req.method === 'GET' &&
      url.pathname === '/api/shipping/agent'
    ) {
      const control = await getShippingAgentControl(supabase)

      sendJson(res, 200, {
        ok: true,
        ...control
      })

      return true
    }

    // POST: Enable or disable Shipping Agent
    if (
      req.method === 'POST' &&
      url.pathname === '/api/shipping/agent/control'
    ) {
      let payload

      try {
        payload = await readRequestJson(req)
      } catch {
        sendJson(res, 400, {
          error: 'Invalid JSON request'
        })
        return true
      }

      if (typeof payload?.enabled !== 'boolean') {
        sendJson(res, 400, {
          error: 'enabled must be true or false'
        })
        return true
      }

      const control = await setShippingAgentControl(
        supabase,
        payload.enabled
      )

      await writeLog(
        supabase,
        payload.enabled ? 'agent_enabled' : 'agent_disabled',
        {
          enabled: payload.enabled,
          changed_by: auth.user.id
        }
      )

      sendJson(res, 200, {
        ok: true,
        ...control
      })

      return true
    }

    // POST: Manually run Shipping Agent
    if (
      req.method === 'POST' &&
      url.pathname === '/api/shipping/agent/run'
    ) {
      const control = await getShippingAgentControl(supabase)

      if (!control.enabled) {
        sendJson(res, 409, {
          error: 'Enable Shipping Agent before running it'
        })
        return true
      }

      await runShippingAgent({
        supabase,
        sendAndLog
      })

      sendJson(res, 200, {
        ok: true,
        message: 'Shipping Agent run requested'
      })

      return true
    }

    // GET: Courier list
    if (
      req.method === 'GET' &&
      url.pathname === '/api/shipping/couriers'
    ) {
      const { data, error } = await supabase
        .from('shipping_couriers')
        .select('*')
        .order('courier_name')

      if (error) throw error

      sendJson(res, 200, {
        ok: true,
        couriers: data || []
      })

      return true
    }

    // GET: Shipment list
    if (
      req.method === 'GET' &&
      url.pathname === '/api/shipping/shipments'
    ) {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      sendJson(res, 200, {
        ok: true,
        shipments: data || []
      })

      return true
    }

    // GET: Shipment tracking history
    if (
      req.method === 'GET' &&
      url.pathname === '/api/shipping/tracking'
    ) {
      const shipmentId = String(
        url.searchParams.get('shipment_id') || ''
      ).trim()

      if (!shipmentId) {
        sendJson(res, 400, {
          error: 'shipment_id is required'
        })
        return true
      }

      const { data, error } = await supabase
        .from('shipment_tracking')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('event_time', { ascending: false })

      if (error) throw error

      sendJson(res, 200, {
        ok: true,
        tracking: data || []
      })

      return true
    }

    // GET: Agent activity logs
    if (
      req.method === 'GET' &&
      url.pathname === '/api/shipping/logs'
    ) {
      const { data, error } = await supabase
        .from('shipping_agent_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      sendJson(res, 200, {
        ok: true,
        logs: data || []
      })

      return true
    }

    // POST: Create manual shipment
    if (
      req.method === 'POST' &&
      url.pathname === '/api/shipping/shipments'
    ) {
      let payload

      try {
        payload = await readRequestJson(req)
      } catch {
        sendJson(res, 400, {
          error: 'Invalid JSON request'
        })
        return true
      }

      const orderId = String(payload?.order_id || '').trim()
      const customerPhone = String(
        payload?.customer_phone || ''
      ).trim()
      const address = String(
        payload?.delivery_address || ''
      ).trim()

      if (!orderId || !customerPhone || !address) {
        sendJson(res, 400, {
          error: 'order_id, customer_phone and delivery_address are required'
        })
        return true
      }

      const { data: existing, error: existingError } =
        await supabase
          .from('shipments')
          .select('id')
          .eq('order_id', orderId)
          .not('status', 'eq', 'cancelled')
          .limit(1)
          .maybeSingle()

      if (existingError) throw existingError

      if (existing) {
        sendJson(res, 409, {
          error: 'An active shipment already exists for this order'
        })
        return true
      }

      const shipment = {
        order_id: orderId,
        order_number: String(
          payload.order_number || ''
        ).trim() || null,
        customer_name: String(
          payload.customer_name || ''
        ).trim() || null,
        customer_phone: customerPhone,
        delivery_address: address,
        city: String(payload.city || '').trim() || null,
        courier_code: String(
          payload.courier_code || ''
        ).trim() || null,
        service_type: String(
          payload.service_type || ''
        ).trim() || null,
        cod_amount: Math.max(
          0,
          Number(payload.cod_amount) || 0
        ),
        shipping_cost: Math.max(
          0,
          Number(payload.shipping_cost) || 0
        ),
        status: 'pending',
        booking_mode: 'manual'
      }

      const { data, error } = await supabase
        .from('shipments')
        .insert(shipment)
        .select()
        .single()

      if (error) throw error

      await addTrackingEvent(
        supabase,
        data.id,
        'pending',
        'Shipment created manually'
      )

      await writeLog(
        supabase,
        'shipment_created',
        {
          order_id: orderId,
          mode: 'manual',
          changed_by: auth.user.id
        },
        data.id
      )

      sendJson(res, 201, {
        ok: true,
        shipment: data
      })

      return true
    }

    // PATCH: Save manual courier booking
    // Tracking number is OPTIONAL.
    const bookingMatch = url.pathname.match(
      /^\/api\/shipping\/shipments\/([a-f0-9-]+)\/booking$/i
    )

    if (req.method === 'PATCH' && bookingMatch) {
      const shipmentId = bookingMatch[1]

      let payload

      try {
        payload = await readRequestJson(req)
      } catch {
        sendJson(res, 400, {
          error: 'Invalid JSON request'
        })
        return true
      }

      const courierCode = String(
        payload?.courier_code || ''
      ).trim()

      const trackingNumber = String(
        payload?.tracking_number || ''
      ).trim()

      // Only courier code is required.
      if (!courierCode) {
        sendJson(res, 400, {
          error: 'courier_code is required'
        })
        return true
      }

      if (trackingNumber.length > 150) {
        sendJson(res, 400, {
          error: 'Tracking number is too long'
        })
        return true
      }

      let shippingCost

      if (payload.shipping_cost !== undefined &&
          payload.shipping_cost !== null &&
          payload.shipping_cost !== '') {
        shippingCost = Number(payload.shipping_cost)

        if (
          !Number.isFinite(shippingCost) ||
          shippingCost < 0
        ) {
          sendJson(res, 400, {
            error: 'Invalid shipping cost'
          })
          return true
        }
      }

      const { data: courier, error: courierError } =
        await supabase
          .from('shipping_couriers')
          .select('courier_code, courier_name')
          .eq('courier_code', courierCode)
          .maybeSingle()

      if (courierError) throw courierError

      if (!courier) {
        sendJson(res, 400, {
          error: 'Courier not found'
        })
        return true
      }

      const updateData = {
        courier_code: courierCode,
        tracking_number: trackingNumber || null,
        status: 'booked',
        booking_mode: 'manual',
        updated_at: new Date().toISOString()
      }

      if (shippingCost !== undefined) {
        updateData.shipping_cost = shippingCost
      }

      const { data, error } = await supabase
        .from('shipments')
        .update(updateData)
        .eq('id', shipmentId)
        .select()
        .maybeSingle()

      if (error) throw error

      if (!data) {
        sendJson(res, 404, {
          error: 'Shipment not found'
        })
        return true
      }

      const trackingDescription = trackingNumber
        ? `Manually booked with ${courier.courier_name}. Tracking Number: ${trackingNumber}`
        : `Manually booked with ${courier.courier_name}. Tracking number will be added later.`

      await addTrackingEvent(
        supabase,
        shipmentId,
        'booked',
        trackingDescription
      )

      await writeLog(
        supabase,
        'shipment_manually_booked',
        {
          courier_code: courierCode,
          tracking_number: trackingNumber || null,
          shipping_cost: data.shipping_cost,
          changed_by: auth.user.id
        },
        shipmentId
      )

      sendJson(res, 200, {
        ok: true,
        message: 'Manual courier booking details saved',
        shipment: data
      })

      return true
    }

    // PATCH: Update shipment status
    const statusMatch = url.pathname.match(
      /^\/api\/shipping\/shipments\/([a-f0-9-]+)\/status$/i
    )

    if (req.method === 'PATCH' && statusMatch) {
      const shipmentId = statusMatch[1]

      let payload

      try {
        payload = await readRequestJson(req)
      } catch {
        sendJson(res, 400, {
          error: 'Invalid JSON request'
        })
        return true
      }

      const status = String(
        payload?.status || ''
      ).trim().toLowerCase()

      if (!ALLOWED_STATUSES.includes(status)) {
        sendJson(res, 400, {
          error: 'Invalid shipment status'
        })
        return true
      }

      const { data, error } = await supabase
        .from('shipments')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', shipmentId)
        .select()
        .maybeSingle()

      if (error) throw error

      if (!data) {
        sendJson(res, 404, {
          error: 'Shipment not found'
        })
        return true
      }

      await addTrackingEvent(
        supabase,
        shipmentId,
        status,
        String(
          payload.description || `Status changed to ${status}`
        ),
        String(payload.location || '').trim() || null
      )

      await writeLog(
        supabase,
        'shipment_status_updated',
        {
          status,
          changed_by: auth.user.id
        },
        shipmentId
      )

      sendJson(res, 200, {
        ok: true,
        shipment: data
      })

      return true
    }

    sendJson(res, 404, {
      error: 'Shipping endpoint not found'
    })

    return true
  } catch (error) {
    console.error('Shipping API error:', error)

    sendJson(res, 500, {
      error: 'Shipping operation failed',
      details: error.message
    })

    return true
  }
}

