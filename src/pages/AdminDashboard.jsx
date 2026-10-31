import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  CreditCard,
  Users,
  Plus,
  Trash2,
  Edit,
  LogOut,
  RefreshCw,
  X,
  Store
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { logoutUser } from '../lib/auth'

export default function AdminDashboard() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [tab, setTab] = useState('overview')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [customers, setCustomers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  const emptyForm = {
    name: '',
    category_id: '',
    description: '',
    price: '',
    old_price: '',
    stock: '',
    image_url: '',
    is_featured: false,
    is_active: true
  }

  const [form, setForm] = useState(emptyForm)

  async function loadData() {
    setLoading(true)

    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError || !user) {
        navigate('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError || profile?.role !== 'admin') {
        toast.error('Admin access required')
        navigate('/')
        return
      }

      setAuthorized(true)

      const results = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'customer')
      ])

      const errors = results.filter(result => result.error)

      if (errors.length) {
        throw new Error(errors[0].error.message)
      }

      setProducts(results[0].data || [])
      setCategories(results[1].data || [])
      setOrders(results[2].data || [])
      setPayments(results[3].data || [])
      setCustomers(results[4].data || [])
    } catch (error) {
      console.error('Dashboard error:', error)
      toast.error(error.message || 'Could not load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function openAddForm() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEditForm(product) {
    setEditingId(product.id)

    setForm({
      name: product.name || '',
      category_id: product.category_id || '',
      description: product.description || '',
      price: product.price ?? '',
      old_price: product.old_price ?? '',
      stock: product.stock ?? '',
      image_url: product.image_url || '',
      is_featured: product.is_featured || false,
      is_active: product.is_active ?? true
    })

    setShowForm(true)
  }

  async function saveProduct(event) {
    event.preventDefault()

    if (!form.name.trim() || form.price === '' || form.stock === '') {
      toast.error('Name, price and stock are required')
      return
    }

    setSaving(true)

    const slug =
      form.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now()

    const payload = {
      name: form.name.trim(),
      slug,
      category_id: form.category_id || null,
      description: form.description,
      price: Number(form.price),
      old_price: form.old_price === '' ? null : Number(form.old_price),
      stock: Number(form.stock),
      image_url: form.image_url.trim() || null,
      is_featured: form.is_featured,
      is_active: form.is_active
    }

    try {
      const result = editingId
        ? await supabase
            .from('products')
            .update(payload)
            .eq('id', editingId)
        : await supabase
            .from('products')
            .insert(payload)

      if (result.error) throw result.error

      toast.success(editingId ? 'Product updated' : 'Product added')

      setShowForm(false)
      setForm(emptyForm)
      setEditingId(null)

      await loadData()
    } catch (error) {
      console.error('Save product error:', error)
      toast.error(error.message || 'Could not save product')
    } finally {
      setSaving(false)
    }
  }

  async function deleteProduct(id) {
    if (!window.confirm('Delete this product?')) return

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Product deleted')
    await loadData()
  }

  async function addCategory() {
    const name = window.prompt('Enter category name:')

    if (!name?.trim()) return

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')

    const { error } = await supabase
      .from('categories')
      .insert({
        name: name.trim(),
        slug
      })

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Category added')
    await loadData()
  }

  async function updateOrderStatus(id, status) {
    const { error } = await supabase
      .from('orders')
      .update({ order_status: status })
      .eq('id', id)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Order status updated')
    await loadData()
  }

  async function updatePaymentStatus(id, status) {
    const { error } = await supabase
      .from('payments')
      .update({
        status,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success(`Payment ${status}`)
    await loadData()
  }

  async function handleLogout() {
    try {
      await logoutUser()
      navigate('/login')
    } catch (error) {
      toast.error(error.message)
    }
  }

  const money = value =>
    `Rs. ${Number(value || 0).toLocaleString('en-PK')}`

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'categories', label: 'Categories', icon: Tags },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'customers', label: 'Customers', icon: Users }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white grid place-items-center">
        <RefreshCw className="animate-spin" size={30} />
      </div>
    )
  }

  if (!authorized) return null

  const stats = [
    { label: 'Products', value: products.length, icon: Package },
    { label: 'Orders', value: orders.length, icon: ShoppingCart },
    { label: 'Customers', value: customers.length, icon: Users },
    {
      label: 'Pending Payments',
      value: payments.filter(p => p.status === 'pending').length,
      icon: CreditCard
    }
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white md:flex">

      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-zinc-900 border-b md:border-b-0 md:border-r border-zinc-800 p-5">

        <h1 className="text-2xl font-bold text-blue-400">
          WaseemTech
        </h1>

        <p className="text-xs text-zinc-400 mt-1 mb-7">
          ADMIN PANEL
        </p>

        <nav className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-1 gap-2">
          {navItems.map(item => {
            const Icon = item.icon

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${
                  tab === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-7 flex items-center gap-2 text-red-400 hover:text-red-300 text-sm"
        >
          <LogOut size={18} />
          Logout
        </button>

      </aside>

      {/* Main Dashboard */}
      <main className="flex-1 p-5 md:p-8 min-w-0">

        {/* Dashboard Header */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-8">

          <div>
            <h2 className="text-2xl font-bold capitalize">
              {tab}
            </h2>

            <p className="text-zinc-400 text-sm mt-1">
              Manage your online store
            </p>
          </div>

          {/* Visit Store + Refresh */}
          <div className="flex flex-wrap items-center gap-3">

            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="flex gap-2 items-center rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-500"
            >
              <Store size={16} />
              Visit Store
            </button>

            <button
              type="button"
              onClick={loadData}
              className="flex gap-2 items-center rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-800"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

          </div>
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

              {stats.map(item => {
                const Icon = item.icon

                return (
                  <div
                    key={item.label}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
                  >
                    <Icon className="text-blue-400 mb-4" size={24} />

                    <p className="text-2xl font-bold">
                      {item.value}
                    </p>

                    <p className="text-zinc-400 text-sm">
                      {item.label}
                    </p>
                  </div>
                )
              })}

            </div>

            <section className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">

              <h3 className="font-semibold mb-4">
                Recent Orders
              </h3>

              {orders.slice(0, 5).map(order => (
                <div
                  key={order.id}
                  className="border-t border-zinc-800 py-3 flex flex-wrap justify-between gap-2 text-sm"
                >
                  <span>
                    {order.order_number || order.id.slice(0, 8)}
                  </span>

                  <span>
                    {money(order.total_amount)}
                  </span>

                  <span className="text-blue-400">
                    {order.order_status}
                  </span>
                </div>
              ))}

              {!orders.length && (
                <p className="text-zinc-500 text-sm">
                  No orders yet.
                </p>
              )}

            </section>
          </>
        )}

        {/* Products */}
        {tab === 'products' && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">

            <div className="flex justify-between items-center gap-3 mb-5">

              <h3 className="font-semibold">
                All Products ({products.length})
              </h3>

              <button
                type="button"
                onClick={openAddForm}
                className="bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 flex items-center gap-2 text-sm"
              >
                <Plus size={17} />
                Add Product
              </button>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-sm text-left min-w-[650px]">

                <thead className="text-zinc-400 border-b border-zinc-700">
                  <tr>
                    <th className="py-3">Product</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {products.map(product => (
                    <tr
                      key={product.id}
                      className="border-b border-zinc-800"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-3">

                          {product.image_url && (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          )}

                          <span>{product.name}</span>

                        </div>
                      </td>

                      <td>{money(product.price)}</td>

                      <td>{product.stock}</td>

                      <td>
                        {product.is_active ? 'Active' : 'Hidden'}
                      </td>

                      <td>
                        <div className="flex gap-3">

                          <button
                            type="button"
                            onClick={() => openEditForm(product)}
                            className="text-blue-400"
                            aria-label="Edit product"
                          >
                            <Edit size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteProduct(product.id)}
                            className="text-red-400"
                            aria-label="Delete product"
                          >
                            <Trash2 size={17} />
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>

              {!products.length && (
                <p className="text-zinc-500 py-5">
                  No products added yet.
                </p>
              )}

            </div>
          </section>
        )}

        {/* Categories */}
        {tab === 'categories' && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">

            <div className="flex justify-between items-center mb-5">

              <h3 className="font-semibold">
                Categories ({categories.length})
              </h3>

              <button
                type="button"
                onClick={addCategory}
                className="bg-blue-600 rounded-lg px-4 py-2 flex gap-2 items-center text-sm"
              >
                <Plus size={17} />
                Add Category
              </button>

            </div>

            {categories.map(category => (
              <div
                key={category.id}
                className="border-t border-zinc-800 py-3"
              >
                {category.name}
              </div>
            ))}

            {!categories.length && (
              <p className="text-zinc-500">
                No categories yet.
              </p>
            )}

          </section>
        )}

        {/* Orders */}
        {tab === 'orders' && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 overflow-x-auto">

            <h3 className="font-semibold mb-5">
              Customer Orders
            </h3>

            <table className="w-full text-sm min-w-[650px]">

              <thead className="text-zinc-400 text-left">
                <tr>
                  <th className="py-3">Order</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Order Status</th>
                  <th>Update</th>
                </tr>
              </thead>

              <tbody>
                {orders.map(order => (
                  <tr
                    key={order.id}
                    className="border-t border-zinc-800"
                  >
                    <td className="py-3">
                      {order.order_number || order.id.slice(0, 8)}
                    </td>

                    <td>{money(order.total_amount)}</td>

                    <td>{order.payment_status}</td>

                    <td>{order.order_status}</td>

                    <td>
                      <select
                        value={order.order_status}
                        onChange={e =>
                          updateOrderStatus(order.id, e.target.value)
                        }
                        className="bg-zinc-800 rounded-lg p-2"
                      >
                        {[
                          'pending',
                          'confirmed',
                          'processing',
                          'shipped',
                          'delivered',
                          'cancelled'
                        ].map(status => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>

            {!orders.length && (
              <p className="text-zinc-500">
                No orders yet.
              </p>
            )}

          </section>
        )}

        {/* Payments */}
        {tab === 'payments' && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 overflow-x-auto">

            <h3 className="font-semibold mb-5">
              Payment Reviews
            </h3>

            <table className="w-full text-sm min-w-[650px]">

              <thead className="text-zinc-400 text-left">
                <tr>
                  <th className="py-3">Transaction ID</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Review</th>
                </tr>
              </thead>

              <tbody>
                {payments.map(payment => (
                  <tr
                    key={payment.id}
                    className="border-t border-zinc-800"
                  >
                    <td className="py-3">
                      {payment.transaction_id || 'Not provided'}
                    </td>

                    <td>{payment.payment_method}</td>

                    <td>{money(payment.amount)}</td>

                    <td>{payment.status}</td>

                    <td className="flex gap-2 py-3">

                      <button
                        type="button"
                        onClick={() =>
                          updatePaymentStatus(payment.id, 'approved')
                        }
                        className="text-green-400"
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updatePaymentStatus(payment.id, 'rejected')
                        }
                        className="text-red-400"
                      >
                        Reject
                      </button>

                    </td>
                  </tr>
                ))}
              </tbody>

            </table>

            {!payments.length && (
              <p className="text-zinc-500">
                No payments submitted yet.
              </p>
            )}

          </section>
        )}

        {/* Customers */}
        {tab === 'customers' && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 overflow-x-auto">

            <h3 className="font-semibold mb-5">
              Registered Customers
            </h3>

            <table className="w-full text-sm min-w-[500px]">

              <thead className="text-zinc-400 text-left">
                <tr>
                  <th className="py-3">Name</th>
                  <th>Phone</th>
                  <th>City</th>
                </tr>
              </thead>

              <tbody>
                {customers.map(customer => (
                  <tr
                    key={customer.id}
                    className="border-t border-zinc-800"
                  >
                    <td className="py-3">
                      {customer.full_name || 'Customer'}
                    </td>

                    <td>{customer.phone || '—'}</td>

                    <td>{customer.city || '—'}</td>
                  </tr>
                ))}
              </tbody>

            </table>

            {!customers.length && (
              <p className="text-zinc-500">
                No customers found.
              </p>
            )}

          </section>
        )}

      </main>

      {/* Add/Edit Product Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/80 p-4 grid place-items-center overflow-y-auto">

          <form
            onSubmit={saveProduct}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-xl space-y-4 my-8"
          >

            <div className="flex justify-between items-center">

              <h3 className="text-xl font-bold">
                {editingId ? 'Edit Product' : 'Add Product'}
              </h3>

              <button
                type="button"
                onClick={() => setShowForm(false)}
              >
                <X />
              </button>

            </div>

            <input
              required
              placeholder="Product name"
              value={form.name}
              onChange={e =>
                setForm({ ...form, name: e.target.value })
              }
              className="w-full bg-zinc-800 rounded-lg p-3"
            />

            <select
              value={form.category_id}
              onChange={e =>
                setForm({ ...form, category_id: e.target.value })
              }
              className="w-full bg-zinc-800 rounded-lg p-3"
            >
              <option value="">
                Select category (optional)
              </option>

              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <textarea
              placeholder="Description"
              value={form.description}
              onChange={e =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full bg-zinc-800 rounded-lg p-3 min-h-24"
            />

            <div className="grid grid-cols-2 gap-3">

              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder="Price (Rs.)"
                value={form.price}
                onChange={e =>
                  setForm({ ...form, price: e.target.value })
                }
                className="bg-zinc-800 rounded-lg p-3 min-w-0"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Old price"
                value={form.old_price}
                onChange={e =>
                  setForm({ ...form, old_price: e.target.value })
                }
                className="bg-zinc-800 rounded-lg p-3 min-w-0"
              />

              <input
                required
                type="number"
                min="0"
                placeholder="Stock quantity"
                value={form.stock}
                onChange={e =>
                  setForm({ ...form, stock: e.target.value })
                }
                className="bg-zinc-800 rounded-lg p-3 min-w-0"
              />

            </div>

            <input
              placeholder="Product image URL"
              value={form.image_url}
              onChange={e =>
                setForm({ ...form, image_url: e.target.value })
              }
              className="w-full bg-zinc-800 rounded-lg p-3"
            />

            <label className="flex gap-2 items-center text-sm">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={e =>
                  setForm({
                    ...form,
                    is_featured: e.target.checked
                  })
                }
              />
              Featured product
            </label>

            <label className="flex gap-2 items-center text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e =>
                  setForm({
                    ...form,
                    is_active: e.target.checked
                  })
                }
              />
              Active (visible in store)
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg p-3 font-semibold"
            >
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Update Product'
                  : 'Save Product'}
            </button>

          </form>
        </div>
      )}

    </div>
  )
}
