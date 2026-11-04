import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import {
  Plus, RefreshCw, Truck, Package, Save, Power,
  Link2, ClipboardList, Calculator
} from 'lucide-react'

const money = value =>
  `Rs. ${Number(value || 0).toLocaleString('en-PK', {
    maximumFractionDigits: 2
  })}`

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100'

const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-purple-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50'

const supplierStatuses = [
  'pending', 'submitted', 'accepted', 'processing',
  'shipped', 'delivered', 'cancelled', 'failed'
]

function Panel({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="font-bold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Status({ value }) {
  const colors = {
    pending: 'bg-amber-100 text-amber-800',
    submitted: 'bg-blue-100 text-blue-800',
    accepted: 'bg-cyan-100 text-cyan-800',
    processing: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    failed: 'bg-red-100 text-red-800'
  }

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${colors[value] || 'bg-slate-100 text-slate-700'}`}>
      {value || 'unknown'}
    </span>
  )
}

function SupplierOrderRow({ item, onSave, savingId }) {
  const [status, setStatus] = useState(item.status || 'pending')
  const [tracking, setTracking] = useState(item.tracking_number || '')
  const [supplierNumber, setSupplierNumber] = useState(item.supplier_order_number || '')
  const [notes, setNotes] = useState(item.notes || '')

  useEffect(() => {
    setStatus(item.status || 'pending')
    setTracking(item.tracking_number || '')
    setSupplierNumber(item.supplier_order_number || '')
    setNotes(item.notes || '')
  }, [item])

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">
            {item.orders?.order_number || `Order ${item.order_id?.slice(0, 8)}`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Supplier: {item.suppliers?.supplier_name || 'Unknown'} · {item.suppliers?.platform || 'other'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Assigned: {item.assigned_at ? new Date(item.assigned_at).toLocaleString() : '—'}
          </p>
        </div>
        <Status value={status} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Supplier order number</label>
          <input className={inputClass} value={supplierNumber} onChange={e => setSupplierNumber(e.target.value)} placeholder="Supplier reference" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Tracking number</label>
          <input className={inputClass} value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Tracking ID" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Supplier status</label>
          <select className={inputClass} value={status} onChange={e => setStatus(e.target.value)}>
            {supplierStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Other costs (Rs.)</label>
          <input className={inputClass} type="number" min="0" step="0.01" value={item.other_cost ?? 0} readOnly />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Notes</label>
          <input className={inputClass} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional supplier notes" />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className={buttonClass}
          disabled={savingId === item.id}
          onClick={() => onSave(item.id, {
            status,
            tracking_number: tracking.trim() || null,
            supplier_order_number: supplierNumber.trim() || null,
            notes: notes.trim() || null
          })}
        >
          <Save size={16} /> {savingId === item.id ? 'Saving...' : 'Save supplier update'}
        </button>
      </div>
    </div>
  )
}

export default function Dropshipping() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState(null)

  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [supplierProducts, setSupplierProducts] = useState([])
  const [dropshipOrders, setDropshipOrders] = useState([])
  const [dropshipItems, setDropshipItems] = useState([])

  const [supplierForm, setSupplierForm] = useState({
    platform: 'markaz',
    supplier_name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    notes: ''
  })

  const [mapping, setMapping] = useState({
    supplier_id: '',
    product_id: '',
    supplier_sku: '',
    supplier_cost: '',
    supplier_delivery_cost: '0'
  })

  const [assignment, setAssignment] = useState({
    order_id: '',
    supplier_id: '',
    supplier_shipping_cost: '0',
    other_cost: '0'
  })

  async function loadData() {
    setLoading(true)
    try {
      const [
        supplierResult,
        productResult,
        orderResult,
        supplierProductResult,
        dropshipResult,
        itemResult
      ] = await Promise.all([
        supabase.from('suppliers').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('id,name,price,stock,is_active').order('name'),
        supabase.from('orders').select('id,order_number,total_amount,order_status,payment_status,created_at').order('created_at', { ascending: false }),
        supabase.from('supplier_products').select('*').order('created_at', { ascending: false }),
        supabase.from('dropship_orders').select('*, suppliers(supplier_name,platform), orders(order_number,total_amount)').order('assigned_at', { ascending: false }),
        supabase.from('dropship_order_items').select('*')
      ])

      const results = [
        supplierResult, productResult, orderResult,
        supplierProductResult, dropshipResult, itemResult
      ]
      const failed = results.find(r => r.error)
      if (failed) throw failed.error

      setSuppliers(supplierResult.data || [])
      setProducts(productResult.data || [])
      setOrders(orderResult.data || [])
      setSupplierProducts(supplierProductResult.data || [])
      setDropshipOrders(dropshipResult.data || [])
      setDropshipItems(itemResult.data || [])
    } catch (error) {
      console.error('Dropshipping load error:', error)
      toast.error(error.message || 'Could not load dropshipping data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const activeSuppliers = suppliers.filter(s => s.is_active)
  const activeProducts = products.filter(p => p.is_active)

  const profitByOrder = useMemo(() => {
    const result = {}
    for (const order of dropshipOrders) {
      const items = dropshipItems.filter(i => i.dropship_order_id === order.id)
      const sales = items.reduce(
        (sum, i) => sum + Number(i.sale_unit_price || 0) * Number(i.quantity || 0), 0
      )
      const productCosts = items.reduce(
        (sum, i) => sum + Number(i.supplier_unit_cost || 0) * Number(i.quantity || 0), 0
      )
      result[order.id] = {
        sales,
        productCosts,
        shipping: Number(order.supplier_shipping_cost || 0),
        other: Number(order.other_cost || 0),
        profit: sales - productCosts -
          Number(order.supplier_shipping_cost || 0) -
          Number(order.other_cost || 0)
      }
    }
    return result
  }, [dropshipOrders, dropshipItems])

  const totalProfit = Object.values(profitByOrder).reduce(
    (sum, item) => sum + item.profit, 0
  )

  async function addSupplier(event) {
    event.preventDefault()
    if (!supplierForm.supplier_name.trim()) {
      toast.error('Supplier name is required')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('suppliers').insert({
        ...supplierForm,
        supplier_name: supplierForm.supplier_name.trim(),
        contact_name: supplierForm.contact_name.trim() || null,
        email: supplierForm.email.trim() || null,
        phone: supplierForm.phone.trim() || null,
        website: supplierForm.website.trim() || null,
        notes: supplierForm.notes.trim() || null,
        integration_status: 'manual',
        is_active: true
      })
      if (error) throw error

      toast.success('Supplier added')
      setSupplierForm({
        platform: 'markaz', supplier_name: '', contact_name: '',
        email: '', phone: '', website: '', notes: ''
      })
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Could not add supplier')
    } finally {
      setSaving(false)
    }
  }

  async function toggleSupplier(supplier) {
    const action = supplier.is_active ? 'deactivate' : 'activate'
    if (!window.confirm(`Are you sure you want to ${action} this supplier?`)) return

    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: !supplier.is_active, updated_at: new Date().toISOString() })
      .eq('id', supplier.id)

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Supplier ${action}d`)
    await loadData()
  }

  async function saveSupplierProduct(event) {
    event.preventDefault()

    if (!mapping.supplier_id || !mapping.product_id || mapping.supplier_cost === '') {
      toast.error('Supplier, product and supplier cost are required')
      return
    }

    if (Number(mapping.supplier_cost) < 0 || Number(mapping.supplier_delivery_cost) < 0) {
      toast.error('Costs cannot be negative')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('supplier_products').upsert({
        supplier_id: mapping.supplier_id,
        product_id: mapping.product_id,
        supplier_sku: mapping.supplier_sku.trim() || null,
        supplier_cost: Number(mapping.supplier_cost),
        supplier_delivery_cost: Number(mapping.supplier_delivery_cost || 0),
        is_available: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'supplier_id,product_id' })

      if (error) throw error

      toast.success('Supplier product cost saved')
      setMapping({
        supplier_id: mapping.supplier_id,
        product_id: '',
        supplier_sku: '',
        supplier_cost: '',
        supplier_delivery_cost: '0'
      })
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Could not save supplier product')
    } finally {
      setSaving(false)
    }
  }

  async function assignOrder(event) {
    event.preventDefault()
    if (!assignment.order_id || !assignment.supplier_id) {
      toast.error('Select an order and supplier')
      return
    }

    const order = orders.find(o => o.id === assignment.order_id)
    const supplier = activeSuppliers.find(s => s.id === assignment.supplier_id)
    if (!order || !supplier) {
      toast.error('Selected order or supplier is unavailable')
      return
    }

    if (['cancelled'].includes(order.order_status)) {
      toast.error('Cancelled orders cannot be assigned')
      return
    }

    if (Number(assignment.supplier_shipping_cost) < 0 || Number(assignment.other_cost) < 0) {
      toast.error('Costs cannot be negative')
      return
    }

    setSaving(true)
    try {
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id)

      if (orderItemsError) throw orderItemsError
      if (!orderItems?.length) throw new Error('No items found in this customer order')

      const { data: mappings, error: mappingError } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('supplier_id', supplier.id)
        .eq('is_available', true)

      if (mappingError) throw mappingError

      const preparedItems = orderItems.map(orderItem => {
        const supplierProduct = mappings.find(
          m => m.product_id === orderItem.product_id
        )
        if (!supplierProduct) {
          throw new Error(`Supplier cost mapping missing for: ${orderItem.product_name}`)
        }
        return { orderItem, supplierProduct }
      })

      const saleTotal = orderItems.reduce(
        (sum, item) => sum + Number(item.line_total || 0), 0
      )

      const { data: dropship, error: dropshipError } = await supabase
        .from('dropship_orders')
        .insert({
          order_id: order.id,
          supplier_id: supplier.id,
          status: 'pending',
          customer_sale_total: saleTotal,
          supplier_shipping_cost: Number(assignment.supplier_shipping_cost || 0),
          other_cost: Number(assignment.other_cost || 0),
          notes: 'Assigned from LapMob admin dashboard'
        })
        .select()
        .single()

      if (dropshipError) throw dropshipError

      const childRows = preparedItems.map(({ orderItem, supplierProduct }) => ({
        dropship_order_id: dropship.id,
        order_item_id: orderItem.id,
        supplier_product_id: supplierProduct.id,
        product_name: orderItem.product_name,
        supplier_sku: supplierProduct.supplier_sku,
        quantity: Number(orderItem.quantity),
        sale_unit_price: Number(orderItem.unit_price),
        supplier_unit_cost: Number(supplierProduct.supplier_cost)
      }))

      const { error: childError } = await supabase
        .from('dropship_order_items')
        .insert(childRows)

      if (childError) {
        await supabase.from('dropship_orders').delete().eq('id', dropship.id)
        throw childError
      }

      await supabase.from('supplier_order_logs').insert({
        dropship_order_id: dropship.id,
        event_type: 'assigned',
        message: `Order assigned to ${supplier.supplier_name}`,
        details: { order_number: order.order_number || order.id }
      })

      toast.success('Customer order assigned to supplier')
      setAssignment({
        order_id: '', supplier_id: supplier.id,
        supplier_shipping_cost: '0', other_cost: '0'
      })
      await loadData()
    } catch (error) {
      console.error('Assign order error:', error)
      toast.error(error.message || 'Could not assign order')
    } finally {
      setSaving(false)
    }
  }

  async function updateDropshipOrder(id, changes) {
    setSavingId(id)
    try {
      const update = {
        ...changes,
        updated_at: new Date().toISOString()
      }
      if (changes.status === 'submitted') {
        update.submitted_at = new Date().toISOString()
      }
      if (changes.status === 'delivered') {
        update.delivered_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('dropship_orders')
        .update(update)
        .eq('id', id)

      if (error) throw error

      await supabase.from('supplier_order_logs').insert({
        dropship_order_id: id,
        event_type: 'status_update',
        message: `Supplier order updated: ${changes.status}`,
        details: changes
      })

      toast.success('Supplier order updated')
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Could not update supplier order')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dropshipping Management</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage suppliers, supplier costs, order assignments and tracking.
          </p>
        </div>
        <button type="button" onClick={loadData} className={buttonClass}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Active suppliers</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{activeSuppliers.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Assigned supplier orders</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{dropshipOrders.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Estimated total profit</p>
          <p className={`mt-2 text-2xl font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {money(totalProfit)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <strong>Integration notice:</strong> Markaz and Daraz are currently recorded as supplier platforms.
        Orders are managed manually in this dashboard. Automatic order forwarding requires an approved
        supplier API/integration and secure server-side credentials; this page does not send orders
        automatically to either platform.
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white p-10 text-center text-slate-500">
          <RefreshCw className="mx-auto animate-spin" size={25} />
          <p className="mt-3 text-sm">Loading dropshipping data...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Panel title="Add supplier" description="Register Markaz, Daraz or another supplier.">
              <form onSubmit={addSupplier} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select className={inputClass} value={supplierForm.platform} onChange={e => setSupplierForm({ ...supplierForm, platform: e.target.value })}>
                    <option value="markaz">Markaz</option>
                    <option value="daraz">Daraz</option>
                    <option value="other">Other supplier</option>
                  </select>
                  <input className={inputClass} required placeholder="Supplier name *" value={supplierForm.supplier_name} onChange={e => setSupplierForm({ ...supplierForm, supplier_name: e.target.value })} />
                  <input className={inputClass} placeholder="Contact person" value={supplierForm.contact_name} onChange={e => setSupplierForm({ ...supplierForm, contact_name: e.target.value })} />
                  <input className={inputClass} type="email" placeholder="Email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} />
                  <input className={inputClass} placeholder="Phone" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                  <input className={inputClass} placeholder="Website URL" value={supplierForm.website} onChange={e => setSupplierForm({ ...supplierForm, website: e.target.value })} />
                </div>
                <textarea className={inputClass} rows={2} placeholder="Notes (optional)" value={supplierForm.notes} onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })} />
                <button className={buttonClass} disabled={saving}><Plus size={16} /> {saving ? 'Saving...' : 'Add supplier'}</button>
              </form>
            </Panel>

            <Panel title="Supplier product cost" description="Connect one of your store products with a supplier and record purchase costs.">
              <form onSubmit={saveSupplierProduct} className="space-y-3">
                <select className={inputClass} required value={mapping.supplier_id} onChange={e => setMapping({ ...mapping, supplier_id: e.target.value })}>
                  <option value="">Select supplier</option>
                  {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name} ({s.platform})</option>)}
                </select>
                <select className={inputClass} required value={mapping.product_id} onChange={e => setMapping({ ...mapping, product_id: e.target.value })}>
                  <option value="">Select LapMob product</option>
                  {activeProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input className={inputClass} placeholder="Supplier SKU" value={mapping.supplier_sku} onChange={e => setMapping({ ...mapping, supplier_sku: e.target.value })} />
                  <input className={inputClass} required type="number" min="0" step="0.01" placeholder="Unit cost Rs." value={mapping.supplier_cost} onChange={e => setMapping({ ...mapping, supplier_cost: e.target.value })} />
                  <input className={inputClass} type="number" min="0" step="0.01" placeholder="Delivery cost Rs." value={mapping.supplier_delivery_cost} onChange={e => setMapping({ ...mapping, supplier_delivery_cost: e.target.value })} />
                </div>
                <button className={buttonClass} disabled={saving}><Save size={16} /> Save product cost</button>
              </form>
            </Panel>
          </div>

          <Panel title="Supplier directory" description="Deactivate a supplier without deleting its historical records.">
            {suppliers.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="border-b text-xs text-slate-400">
                    <tr><th className="pb-3">Supplier</th><th className="pb-3">Platform</th><th className="pb-3">Contact</th><th className="pb-3">Integration</th><th className="pb-3">Status</th><th className="pb-3">Action</th></tr>
                  </thead>
                  <tbody>
                    {suppliers.map(s => (
                      <tr key={s.id} className="border-b border-slate-50">
                        <td className="py-3 font-semibold">{s.supplier_name}</td>
                        <td className="capitalize">{s.platform}</td>
                        <td>{s.phone || s.email || '—'}</td>
                        <td className="capitalize">{s.integration_status || 'manual'}</td>
                        <td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td>
                          <button type="button" onClick={() => toggleSupplier(s)} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${s.is_active ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            <Power size={13} /> {s.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-slate-500">No suppliers added yet.</p>}
          </Panel>

          <Panel title="Supplier product mappings" description="Supplier purchase costs currently saved for your products.">
            {supplierProducts.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="border-b text-xs text-slate-400">
                    <tr><th className="pb-3">Supplier ID</th><th className="pb-3">Product ID</th><th className="pb-3">SKU</th><th className="pb-3">Unit cost</th><th className="pb-3">Delivery cost</th><th className="pb-3">Available</th></tr>
                  </thead>
                  <tbody>
                    {supplierProducts.map(m => (
                      <tr key={m.id} className="border-b border-slate-50">
                        <td className="py-3 font-mono text-xs">{m.supplier_id.slice(0, 8)}</td>
                        <td className="font-mono text-xs">{m.product_id.slice(0, 8)}</td>
                        <td>{m.supplier_sku || '—'}</td>
                        <td>{money(m.supplier_cost)}</td>
                        <td>{money(m.supplier_delivery_cost)}</td>
                        <td>{m.is_available ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-slate-500">No supplier product costs configured yet.</p>}
          </Panel>

          <Panel title="Assign customer order" description="Assign a non-cancelled customer order after adding supplier cost mappings for all its products.">
            <form onSubmit={assignOrder} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <select className={inputClass} required value={assignment.order_id} onChange={e => setAssignment({ ...assignment, order_id: e.target.value })}>
                <option value="">Select customer order</option>
                {orders.filter(o => o.order_status !== 'cancelled').map(o => (
                  <option key={o.id} value={o.id}>
                    {o.order_number || o.id.slice(0, 8)} · {money(o.total_amount)} · {o.order_status}
                  </option>
                ))}
              </select>
              <select className={inputClass} required value={assignment.supplier_id} onChange={e => setAssignment({ ...assignment, supplier_id: e.target.value })}>
                <option value="">Select supplier</option>
                {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name} ({s.platform})</option>)}
              </select>
              <input className={inputClass} type="number" min="0" step="0.01" placeholder="Supplier shipping cost (Rs.)" value={assignment.supplier_shipping_cost} onChange={e => setAssignment({ ...assignment, supplier_shipping_cost: e.target.value })} />
              <input className={inputClass} type="number" min="0" step="0.01" placeholder="Other costs (Rs.)" value={assignment.other_cost} onChange={e => setAssignment({ ...assignment, other_cost: e.target.value })} />
              <div className="lg:col-span-2">
                <button className={buttonClass} disabled={saving}>
                  <Link2 size={16} /> {saving ? 'Assigning...' : 'Assign order to supplier'}
                </button>
              </div>
            </form>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Note: The same customer order cannot be assigned twice to the same supplier. Ensure that the supplier has a cost mapping for every item in the order.
            </p>
          </Panel>

          <Panel title="Supplier orders & profit" description="Update supplier progress and review estimated order-level profit.">
            {dropshipOrders.length ? (
              <div className="space-y-4">
                {dropshipOrders.map(d => {
                  const p = profitByOrder[d.id] || { sales: 0, productCosts: 0, shipping: 0, other: 0, profit: 0 }
                  return (
                    <div key={d.id} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <div><p className="text-xs text-slate-500">Customer sale</p><p className="mt-1 font-bold">{money(p.sales)}</p></div>
                        <div><p className="text-xs text-slate-500">Supplier items</p><p className="mt-1 font-bold">{money(p.productCosts)}</p></div>
                        <div><p className="text-xs text-slate-500">Supplier shipping</p><p className="mt-1 font-bold">{money(p.shipping)}</p></div>
                        <div><p className="text-xs text-slate-500">Other costs</p><p className="mt-1 font-bold">{money(p.other)}</p></div>
                        <div><p className="text-xs text-slate-500">Estimated profit</p><p className={`mt-1 font-bold ${p.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{money(p.profit)}</p></div>
                      </div>
                      <SupplierOrderRow item={d} onSave={updateDropshipOrder} savingId={savingId} />
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-sm text-slate-500">No supplier orders assigned yet.</p>}
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <Calculator size={16} />
              Profit = customer item sale total − supplier item cost − supplier shipping − other costs. This is an estimate and excludes platform/payment fees unless entered under other costs.
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}