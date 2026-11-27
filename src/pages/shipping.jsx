import { useCallback, useEffect, useState } from 'react'
import {
  Truck, RefreshCw, PackageCheck, Plus, Clock,
  Power, Play, Save, History, X, FileText, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { getWhatsAppApiBaseUrl } from '../lib/whatsappApi'

const statuses = [
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

const initialForm = {
  order_id: '',
  order_number: '',
  customer_name: '',
  customer_phone: '',
  delivery_address: '',
  city: '',
  courier_code: 'tcs',
  service_type: 'standard',
  cod_amount: '',
  shipping_cost: ''
}

const prettyStatus = value =>
  String(value || 'pending')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, c => c.toUpperCase())

export default function Shipping() {
  const [shipments, setShipments] = useState([])
  const [orders, setOrders] = useState([])
  const [preparingOrderId, setPreparingOrderId] = useState(null)
  const [couriers, setCouriers] = useState([])
  const [logs, setLogs] = useState([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('all')
  const [agentEnabled, setAgentEnabled] = useState(null)
  const [agentBusy, setAgentBusy] = useState(false)

  const [bookingShipment, setBookingShipment] = useState(null)
  const [bookingDraft, setBookingDraft] = useState({
    courier_code: '',
    tracking_number: '',
    shipping_cost: ''
  })
  const [bookingSaving, setBookingSaving] = useState(false)

  const [trackingShipment, setTrackingShipment] = useState(null)
  const [trackingEvents, setTrackingEvents] = useState([])
  const [trackingLoading, setTrackingLoading] = useState(false)

  const apiRequest = useCallback(async (path, options = {}) => {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession()

    if (error || !session?.access_token) {
      throw new Error('Admin session expired. Please login again.')
    }

    const apiUrl = getWhatsAppApiBaseUrl()

    const response = await fetch(`${apiUrl}/api/shipping${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...options.headers
      }
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(result.error || 'Shipping API request failed')
    }

    return result
  }, [])

  const loadShipping = useCallback(async () => {
    setLoading(true)

    try {
      const [
        shipmentData,
        courierData,
        logData,
        orderResult,
        agentData
      ] = await Promise.all([
        apiRequest('/shipments'),
        apiRequest('/couriers'),
        apiRequest('/logs'),
        supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        apiRequest('/agent')
      ])

      setAgentEnabled(Boolean(agentData.enabled))

      if (orderResult.error) {
        throw orderResult.error
      }

      setOrders(orderResult.data || [])

      setShipments(
        Array.isArray(shipmentData)
          ? shipmentData
          : shipmentData.shipments || shipmentData.data || []
      )

      setCouriers(
        Array.isArray(courierData)
          ? courierData
          : courierData.couriers || courierData.data || []
      )

      setLogs(
        Array.isArray(logData)
          ? logData
          : logData.logs || logData.data || []
      )
    } catch (error) {
      toast.error(error.message || 'Could not load shipping data')
    } finally {
      setLoading(false)
    }
  }, [apiRequest])

  useEffect(() => {
    loadShipping()
  }, [loadShipping])

  async function toggleShippingAgent() {
    if (agentEnabled === null || agentBusy) return

    const nextEnabled = !agentEnabled
    setAgentBusy(true)

    try {
      const result = await apiRequest('/agent/control', {
        method: 'POST',
        body: JSON.stringify({ enabled: nextEnabled })
      })

      setAgentEnabled(Boolean(result.enabled))

      toast.success(
        nextEnabled
          ? 'Shipping Agent enabled'
          : 'Shipping Agent disabled'
      )

      await loadShipping()
    } catch (error) {
      toast.error(error.message || 'Could not update Shipping Agent')
    } finally {
      setAgentBusy(false)
    }
  }

  async function runShippingAgentNow() {
    if (!agentEnabled || agentBusy) return

    setAgentBusy(true)

    try {
      await apiRequest('/agent/run', {
        method: 'POST'
      })

      toast.success('Shipping Agent run completed/requested')
      await loadShipping()
    } catch (error) {
      toast.error(error.message || 'Shipping Agent run failed')
    } finally {
      setAgentBusy(false)
    }
  }

  async function createShipment(event) {
    event.preventDefault()

    if (
      !form.order_id.trim() ||
      !form.customer_phone.trim() ||
      !form.delivery_address.trim()
    ) {
      toast.error('Order ID, phone and delivery address are required')
      return
    }

    setSaving(true)

    try {
      await apiRequest('/shipments', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          cod_amount: Number(form.cod_amount || 0),
          shipping_cost: Number(form.shipping_cost || 0)
        })
      })

      toast.success('Shipment created successfully')
      setForm(initialForm)
      setShowForm(false)
      await loadShipping()
    } catch (error) {
      toast.error(error.message || 'Shipment creation failed')
    } finally {
      setSaving(false)
    }
  }

  async function createShipmentFromOrder(order) {
    const orderId = String(order.id || '').trim()

    const phone = String(
      order.customer_phone ||
      order.phone ||
      order.shipping_phone ||
      ''
    ).trim()

    const address = String(
      order.shipping_address ||
      order.delivery_address ||
      ''
    ).trim()

    if (!orderId || !phone || !address) {
      toast.error('Order ID, customer phone and delivery address are required')
      return
    }

    if (
      shipments.some(item =>
        String(item.order_id) === orderId &&
        item.status !== 'cancelled'
      )
    ) {
      toast.error('An active shipment already exists for this order')
      return
    }

    const paymentMethod = String(
      order.payment_method ||
      order.payment_type ||
      ''
    ).toLowerCase()

    setPreparingOrderId(orderId)

    try {
      await apiRequest('/shipments', {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderId,
          order_number: order.order_number || orderId.slice(0, 8),
          customer_name: order.customer_name || order.name || '',
          customer_phone: phone,
          delivery_address: address,
          city: order.shipping_city || order.city || '',
          courier_code:
            couriers.find(item => item.is_active)?.courier_code || '',
          service_type: 'standard',
          cod_amount: paymentMethod.includes('cod')
            ? Math.max(0, Number(order.total_amount) || 0)
            : 0,
          shipping_cost: 0
        })
      })

      toast.success('Shipment prepared successfully')
      await loadShipping()
    } catch (error) {
      toast.error(error.message || 'Could not prepare shipment')
    } finally {
      setPreparingOrderId(null)
    }
  }

  async function updateStatus(shipmentId, status) {
    try {
      await apiRequest(`/shipments/${shipmentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      })

      toast.success('Shipment status updated')
      await loadShipping()
    } catch (error) {
      toast.error(error.message || 'Status update failed')
    }
  }

  function openBookingForm(shipment) {
    setBookingShipment(shipment)

    setBookingDraft({
      courier_code:
        shipment.courier_code ||
        couriers.find(item => item.is_active)?.courier_code ||
        '',
      tracking_number: shipment.tracking_number || '',
      shipping_cost: shipment.shipping_cost ?? ''
    })
  }

  // Tracking number is OPTIONAL.
  // It can be added later using Edit Booking.
  async function saveManualBooking(event) {
    event.preventDefault()

    if (!bookingShipment) return

    if (!bookingDraft.courier_code) {
      toast.error('Please select a courier')
      return
    }

    setBookingSaving(true)

    try {
      await apiRequest(
        `/shipments/${bookingShipment.id}/booking`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            courier_code: bookingDraft.courier_code,

            // Empty tracking number is sent as null.
            tracking_number:
              bookingDraft.tracking_number.trim() || null,

            ...(bookingDraft.shipping_cost !== ''
              ? {
                  shipping_cost: Number(bookingDraft.shipping_cost)
                }
              : {})
          })
        }
      )

      toast.success(
        bookingDraft.tracking_number.trim()
          ? 'Courier booking details saved'
          : 'Courier assigned successfully. Tracking number can be added later.'
      )

      setBookingShipment(null)
      await loadShipping()
    } catch (error) {
      toast.error(error.message || 'Could not save booking details')
    } finally {
      setBookingSaving(false)
    }
  }

  async function loadTrackingHistory(shipment) {
    setTrackingShipment(shipment)
    setTrackingLoading(true)
    setTrackingEvents([])

    try {
      const result = await apiRequest(
        `/tracking?shipment_id=${encodeURIComponent(shipment.id)}`
      )

      setTrackingEvents(result.tracking || [])
    } catch (error) {
      toast.error(error.message || 'Could not load tracking history')
    } finally {
      setTrackingLoading(false)
    }
  }

  const filteredShipments = shipments.filter(item =>
    filter === 'all' || item.status === filter
  )

  const activeOrderIds = new Set(
    shipments
      .filter(item => item.status !== 'cancelled')
      .map(item => String(item.order_id))
  )

  const eligibleOrders = orders.filter(order =>
    ['confirmed', 'processing'].includes(
      String(order.order_status || '').toLowerCase()
    ) &&
    !activeOrderIds.has(String(order.id))
  )

  const activeCount = shipments.filter(item =>
    !['delivered', 'cancelled', 'returned'].includes(item.status)
  ).length

  const deliveredCount = shipments.filter(
    item => item.status === 'delivered'
  ).length

  const failedCount = shipments.filter(item =>
    ['failed', 'returned'].includes(item.status)
  ).length

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100'

  const cardClass =
    'rounded-2xl border border-purple-100 bg-white p-5 shadow-sm'

  return (
    <div className="space-y-6">

      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-purple-950">
            Shipping Management
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage shipments, couriers and delivery progress
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadShipping}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-4 py-2.5 text-sm font-semibold text-purple-800 hover:bg-purple-50 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-xl bg-purple-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-900"
          >
            <Plus size={17} />
            New Shipment
          </button>
        </div>
      </div>

      {/* SHIPPING AGENT */}
      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-purple-950">
              Shipping Agent Control
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Automatically prepare eligible orders and process shipping notifications
            </p>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  agentEnabled === null
                    ? 'bg-slate-400'
                    : agentEnabled
                      ? 'bg-green-500'
                      : 'bg-red-500'
                }`}
              />

              <span className="text-sm font-bold text-slate-700">
                {agentEnabled === null
                  ? 'Loading status...'
                  : agentEnabled
                    ? 'Agent is ON'
                    : 'Agent is OFF'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleShippingAgent}
              disabled={agentEnabled === null || agentBusy}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${
                agentEnabled
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-700 hover:bg-green-800'
              }`}
            >
              <Power size={16} />
              {agentBusy
                ? 'Please wait...'
                : agentEnabled
                  ? 'Turn OFF'
                  : 'Turn ON'}
            </button>

            <button
              type="button"
              onClick={runShippingAgentNow}
              disabled={!agentEnabled || agentBusy}
              className="flex items-center gap-2 rounded-xl bg-purple-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-900 disabled:opacity-50"
            >
              <Play size={16} />
              Run Now
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Courier booking remains manual unless an approved courier integration is configured.
        </p>
      </div>

      {/* STATISTICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={cardClass}>
          <p className="text-sm font-semibold text-slate-500">
            Total Shipments
          </p>
          <p className="mt-2 text-3xl font-extrabold text-purple-950">
            {shipments.length}
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-semibold text-slate-500">
            Active Shipments
          </p>
          <p className="mt-2 text-3xl font-extrabold text-blue-700">
            {activeCount}
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-semibold text-slate-500">
            Delivered
          </p>
          <p className="mt-2 text-3xl font-extrabold text-green-700">
            {deliveredCount}
          </p>
        </div>

        <div className={cardClass}>
          <p className="text-sm font-semibold text-slate-500">
            Failed / Returned
          </p>
          <p className="mt-2 text-3xl font-extrabold text-red-600">
            {failedCount}
          </p>
        </div>
      </div>

      {/* ELIGIBLE ORDERS */}
      <div className={cardClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-purple-950">
              Orders Waiting for Shipment
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Confirmed and processing orders without an active shipment
            </p>
          </div>

          <span className="rounded-full bg-purple-50 px-3 py-1 text-sm font-bold text-purple-800">
            {eligibleOrders.length} eligible
          </span>
        </div>

        {eligibleOrders.length > 0 ? (
          <div className="space-y-3">
            {eligibleOrders.map(order => {
              const phone =
                order.customer_phone ||
                order.phone ||
                order.shipping_phone

              const address =
                order.shipping_address ||
                order.delivery_address

              return (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">
                      {order.order_number || String(order.id).slice(0, 8)}
                      {' · '}
                      {order.customer_name || 'Customer'}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {phone || 'No phone'}
                      {' · '}
                      {order.shipping_city || order.city || 'City not provided'}
                    </p>

                    <p className="mt-1 max-w-xl truncate text-xs text-slate-500">
                      {address || 'Address not provided'}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-purple-800">
                      Status: {order.order_status}
                      {' · '}
                      Rs. {Number(order.total_amount || 0).toLocaleString()}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => createShipmentFromOrder(order)}
                    disabled={
                      Boolean(preparingOrderId) ||
                      !phone ||
                      !address
                    }
                    className="rounded-xl bg-purple-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {preparingOrderId === String(order.id)
                      ? 'Preparing...'
                      : 'Prepare Shipment'}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="py-5 text-center text-sm text-slate-500">
            No confirmed or processing orders waiting for shipment.
          </p>
        )}
      </div>

      {/* NEW SHIPMENT FORM */}
      {showForm && (
        <form onSubmit={createShipment} className={cardClass}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-purple-950">
              Create Shipment
            </h3>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm font-semibold text-slate-500 hover:text-purple-800"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['order_id', 'Order ID *'],
              ['order_number', 'Order Number'],
              ['customer_name', 'Customer Name'],
              ['customer_phone', 'Customer Phone *'],
              ['city', 'City'],
              ['cod_amount', 'COD Amount (Rs.)'],
              ['shipping_cost', 'Shipping Cost (Rs.)']
            ].map(([key, label]) => (
              <label key={key} className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">
                  {label}
                </span>

                <input
                  className={inputClass}
                  type={
                    ['cod_amount', 'shipping_cost'].includes(key)
                      ? 'number'
                      : 'text'
                  }
                  min={
                    ['cod_amount', 'shipping_cost'].includes(key)
                      ? '0'
                      : undefined
                  }
                  value={form[key]}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      [key]: e.target.value
                    }))
                  }
                  required={['order_id', 'customer_phone'].includes(key)}
                />
              </label>
            ))}

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">
                Courier
              </span>

              <select
                className={inputClass}
                value={form.courier_code}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    courier_code: e.target.value
                  }))
                }
              >
                {couriers.map(courier => (
                  <option
                    key={courier.id}
                    value={courier.courier_code}
                  >
                    {courier.courier_name}
                    {courier.is_active ? '' : ' (Inactive)'}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">
                Service Type
              </span>

              <select
                className={inputClass}
                value={form.service_type}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    service_type: e.target.value
                  }))
                }
              >
                <option value="standard">Standard</option>
                <option value="express">Express</option>
                <option value="same_day">Same Day</option>
              </select>
            </label>

            <label className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <span className="text-sm font-semibold text-slate-700">
                Delivery Address *
              </span>

              <textarea
                className={inputClass}
                rows={3}
                value={form.delivery_address}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    delivery_address: e.target.value
                  }))
                }
                required
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-purple-800 px-6 py-3 text-sm font-bold text-white hover:bg-purple-900 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Shipment'}
            </button>
          </div>
        </form>
      )}

      {/* SHIPMENTS TABLE */}
      <div className={cardClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-purple-950">
            Shipments
          </h3>

          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">All statuses</option>

            {statuses.map(status => (
              <option key={status} value={status}>
                {prettyStatus(status)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Loading shipping data...
          </p>
        ) : filteredShipments.length === 0 ? (
          <div className="py-10 text-center">
            <Truck
              className="mx-auto mb-3 text-purple-300"
              size={36}
            />

            <p className="font-semibold text-slate-700">
              No shipments found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Create a shipment to start managing deliveries.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                  <th className="px-3 py-3">Order</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Courier</th>
                  <th className="px-3 py-3">Tracking</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Update Status</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredShipments.map(item => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-50 hover:bg-purple-50/40"
                  >
                    <td className="px-3 py-4 font-bold text-purple-950">
                      {item.order_number || item.order_id}
                    </td>

                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-800">
                        {item.customer_name || 'Customer'}
                      </p>

                      <p className="text-xs text-slate-500">
                        {item.customer_phone}
                      </p>
                    </td>

                    <td className="px-3 py-4 capitalize">
                      {item.courier_code || 'Not assigned'}
                    </td>

                    <td className="px-3 py-4">
                      {item.tracking_number || 'Not booked'}
                    </td>

                    <td className="px-3 py-4">
                      <span className="inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-800">
                        {prettyStatus(item.status)}
                      </span>
                    </td>

                    <td className="px-3 py-4">
                      <select
                        className="max-w-40 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"
                        value={item.status}
                        onChange={e =>
                          updateStatus(item.id, e.target.value)
                        }
                      >
                        {statuses.map(status => (
                          <option key={status} value={status}>
                            {prettyStatus(status)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openBookingForm(item)}
                          className="inline-flex items-center gap-1 rounded-lg bg-purple-800 px-3 py-2 text-xs font-bold text-white hover:bg-purple-900"
                        >
                          <FileText size={14} />
                          {item.tracking_number
                            ? 'Edit Booking'
                            : 'Book Courier'}
                        </button>

                        <button
                          type="button"
                          onClick={() => loadTrackingHistory(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-purple-200 px-3 py-2 text-xs font-bold text-purple-800 hover:bg-purple-50"
                        >
                          <History size={14} />
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MANUAL COURIER BOOKING */}
      {bookingShipment && (
        <form
          onSubmit={saveManualBooking}
          className={cardClass}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-purple-950">
                Manual Courier Booking
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Order{' '}
                {bookingShipment.order_number ||
                  bookingShipment.order_id}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setBookingShipment(null)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close booking form"
            >
              <X size={19} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            {/* COURIER */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">
                Courier *
              </span>

              <select
                className={inputClass}
                value={bookingDraft.courier_code}
                onChange={e =>
                  setBookingDraft(prev => ({
                    ...prev,
                    courier_code: e.target.value
                  }))
                }
                required
              >
                <option value="">Select courier</option>

                {couriers.map(courier => (
                  <option
                    key={courier.id}
                    value={courier.courier_code}
                  >
                    {courier.courier_name}
                    {courier.is_active ? '' : ' (Inactive)'}
                  </option>
                ))}
              </select>
            </label>

            {/* TRACKING NUMBER - OPTIONAL */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">
                Tracking Number (Optional)
              </span>

              <input
                className={inputClass}
                value={bookingDraft.tracking_number}
                onChange={e =>
                  setBookingDraft(prev => ({
                    ...prev,
                    tracking_number: e.target.value
                  }))
                }
                placeholder="Add later if not available"
                maxLength={150}
              />

              <span className="block text-xs text-slate-500">
                You can add the tracking number later using Edit Booking.
              </span>
            </label>

            {/* SHIPPING COST */}
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">
                Shipping Cost (Rs.)
              </span>

              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={bookingDraft.shipping_cost}
                onChange={e =>
                  setBookingDraft(prev => ({
                    ...prev,
                    shipping_cost: e.target.value
                  }))
                }
                placeholder="0"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Courier assignment can be saved now. Add the tracking number when the courier provides it.
            </p>

            <button
              type="submit"
              disabled={bookingSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-800 px-5 py-3 text-sm font-bold text-white hover:bg-purple-900 disabled:opacity-50"
            >
              <Save size={16} />
              {bookingSaving ? 'Saving...' : 'Save Booking'}
            </button>
          </div>
        </form>
      )}

      {/* TRACKING HISTORY */}
      {trackingShipment && (
        <div className={cardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-purple-950">
                Tracking History
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Order{' '}
                {trackingShipment.order_number ||
                  trackingShipment.order_id}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setTrackingShipment(null)
                setTrackingEvents([])
              }}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close tracking history"
            >
              <X size={19} />
            </button>
          </div>

          {trackingLoading ? (
            <p className="py-5 text-center text-sm text-slate-500">
              Loading tracking history...
            </p>
          ) : trackingEvents.length ? (
            <div className="space-y-3">
              {trackingEvents.map(event => (
                <div
                  key={event.id}
                  className="flex gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <div className="mt-1 text-purple-700">
                    <PackageCheck size={17} />
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold text-slate-800">
                      {prettyStatus(event.status)}
                    </p>

                    {event.description && (
                      <p className="mt-1 text-sm text-slate-600">
                        {event.description}
                      </p>
                    )}

                    {event.location && (
                      <p className="mt-1 text-xs text-slate-500">
                        Location: {event.location}
                      </p>
                    )}

                    <p className="mt-1 text-xs text-slate-400">
                      {event.event_time
                        ? new Date(event.event_time).toLocaleString()
                        : event.created_at
                          ? new Date(event.created_at).toLocaleString()
                          : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-5 text-center text-sm text-slate-500">
              No tracking events found for this shipment.
            </p>
          )}
        </div>
      )}

      {/* COURIERS AND ACTIVITY */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

        {/* COURIER PARTNERS */}
        <div className={cardClass}>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-purple-950">
            <Truck size={19} />
            Courier Partners
          </h3>

          <div className="space-y-3">
            {couriers.map(courier => (
              <div
                key={courier.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
              >
                <div>
                  <p className="font-bold text-slate-800">
                    {courier.courier_name}
                  </p>

                  <p className="text-xs text-slate-500">
                    {courier.integration_mode?.toUpperCase() || 'MANUAL'} integration
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    courier.is_active
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {courier.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}

            {couriers.length === 0 && (
              <p className="text-sm text-slate-500">
                No courier records available.
              </p>
            )}
          </div>
        </div>

        {/* RECENT ACTIVITY */}
        <div className={cardClass}>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-purple-950">
            <Clock size={19} />
            Recent Shipping Activity
          </h3>

          <div className="space-y-3">
            {logs.slice(0, 8).map(log => (
              <div
                key={log.id}
                className="flex gap-3 border-b border-slate-100 pb-3"
              >
                <div className="mt-1 text-purple-700">
                  <PackageCheck size={17} />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    {prettyStatus(log.action)}
                  </p>

                  <p className="text-xs text-slate-500">
                    {log.result || 'Shipping activity recorded'}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString()
                      : ''}
                  </p>
                </div>
              </div>
            ))}

            {logs.length === 0 && (
              <p className="text-sm text-slate-500">
                No shipping activity yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* MANUAL MODE NOTICE */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle size={19} className="mt-0.5 shrink-0" />

        <p>
          Courier booking is currently in manual mode. Automatic booking and
          live tracking require approved courier API credentials.
        </p>
      </div>
    </div>
  )
}
