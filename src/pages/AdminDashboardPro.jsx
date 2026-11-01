
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Tags, ShoppingCart, CreditCard, Users,
  Plus, Trash2, Edit, LogOut, RefreshCw, X, Store, Search,
  TrendingUp, Wallet, AlertTriangle, Download, BarChart3,
  CheckCircle2, Clock, Eye, Star, Menu
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { logoutUser } from '../lib/auth'

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

const orderStatuses = [
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
]

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

function StatCard({ title, value, subtitle, icon: Icon, color = 'purple' }) {
  const colors = {
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-lime-100 text-lime-800',
    orange: 'bg-orange-100 text-orange-700',
    blue: 'bg-blue-100 text-blue-700'
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">{value}</h3>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className={`rounded-2xl p-3 ${colors[color]}`}>
          <Icon size={23} />
        </div>
      </div>
    </div>
  )
}

function SectionHeading({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

function StatusBadge({ value }) {
  const status = String(value || 'unknown').toLowerCase()
  const styles = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-blue-100 text-blue-800',
    processing: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-lime-100 text-lime-800',
    cancelled: 'bg-red-100 text-red-800',
    approved: 'bg-lime-100 text-lime-800',
    rejected: 'bg-red-100 text-red-800'
  }

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  )
}

export default function AdminDashboardPro() {
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
  const [search, setSearch] = useState('')
  const [orderFilter, setOrderFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [mobileMenu, setMobileMenu] = useState(false)
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

      const failed = results.find(result => result.error)
      if (failed) throw failed.error

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

  const analytics = useMemo(() => {
    const validOrders = orders.filter(
      order => String(order.order_status).toLowerCase() !== 'cancelled'
    )

    const revenue = validOrders.reduce(
      (sum, order) => sum + Number(order.total_amount || 0), 0
    )

    const pendingPayments = payments.filter(
      payment => payment.status === 'pending'
    ).length

    const lowStock = products.filter(
      product => Number(product.stock || 0) <= 5
    )

    const averageOrder = validOrders.length
      ? revenue / validOrders.length
      : 0

    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      const key = date.toLocaleDateString('en-CA')

      const total = validOrders
        .filter(order =>
          order.created_at &&
          new Date(order.created_at).toLocaleDateString('en-CA') === key
        )
        .reduce((sum, order) => sum + Number(order.total_amount || 0), 0)

      return {
        label: date.toLocaleDateString('en-PK', { weekday: 'short' }),
        total
      }
    })

    const maxDaily = Math.max(...lastSevenDays.map(day => day.total), 1)

    const monthly = Array.from({ length: 6 }, (_, index) => {
      const date = new Date()
      date.setMonth(date.getMonth() - (5 - index))
      const month = date.getMonth()
      const year = date.getFullYear()

      const total = validOrders
        .filter(order => {
          if (!order.created_at) return false
          const orderDate = new Date(order.created_at)
          return orderDate.getMonth() === month && orderDate.getFullYear() === year
        })
        .reduce((sum, order) => sum + Number(order.total_amount || 0), 0)

      return {
        label: date.toLocaleDateString('en-PK', { month: 'short' }),
        total
      }
    })

    const maxMonthly = Math.max(...monthly.map(item => item.total), 1)

    const statusCounts = orderStatuses.map(status => ({
      status,
      count: orders.filter(
        order => String(order.order_status).toLowerCase() === status
      ).length
    }))

    return {
      revenue,
      pendingPayments,
      lowStock,
      averageOrder,
      lastSevenDays,
      maxDaily,
      monthly,
      maxMonthly,
      statusCounts,
      validOrders
    }
  }, [orders, products, payments])

  const filteredProducts = products.filter(product =>
    product.name?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      String(order.order_number || order.id).toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      orderFilter === 'all' || order.order_status === orderFilter
    return matchesSearch && matchesStatus
  })

  const filteredPayments = payments.filter(payment => {
    const matchesSearch =
      String(payment.transaction_id || payment.id).toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      paymentFilter === 'all' || payment.status === paymentFilter
    return matchesSearch && matchesStatus
  })

  const filteredCustomers = customers.filter(customer =>
    `${customer.full_name || ''} ${customer.email || ''} ${customer.phone || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

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

    if (Number(form.price) < 0 || Number(form.stock) < 0) {
      toast.error('Price and stock cannot be negative')
      return
    }

    setSaving(true)

    const slug =
      form.name.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' + Date.now()

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
        ? await supabase.from('products').update(payload).eq('id', editingId)
        : await supabase.from('products').insert(payload)

      if (result.error) throw result.error

      toast.success(editingId ? 'Product updated' : 'Product added')
      setShowForm(false)
      setForm(emptyForm)
      setEditingId(null)
      await loadData()
    } catch (error) {
      toast.error(error.message || 'Could not save product')
    } finally {
      setSaving(false)
    }
  }

  async function deleteProduct(id) {
    if (!window.confirm('Are you sure you want to delete this product?')) return

    const { error } = await supabase.from('products').delete().eq('id', id)

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

    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')

    const { error } = await supabase.from('categories').insert({
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
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success(`Payment ${status}`)
    await loadData()
  }

  function exportCSV(rows, filename) {
    if (!rows.length) {
      toast.error('No records available to export')
      return
    }

    const headers = Object.keys(rows[0])
    const escapeCSV = value =>
      `"${String(value ?? '').replace(/"/g, '""')}"`

    const csv = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => headers.map(key => escapeCSV(row[key])).join(','))
    ].join('\n')

    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;'
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    toast.success('CSV report downloaded')
  }

  async function handleLogout() {
    try {
      await logoutUser()
      navigate('/login')
    } catch (error) {
      toast.error(error.message)
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-center">
          <RefreshCw className="mx-auto animate-spin text-purple-700" size={34} />
          <p className="mt-3 text-sm font-medium text-slate-500">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!authorized) return null

  const pageTitles = {
    overview: 'Dashboard Overview',
    products: 'Product Management',
    categories: 'Category Management',
    orders: 'Order Management',
    payments: 'Payment Management',
    customers: 'Customer Directory'
  }

  return (
    <div className="min-h-screen bg-[#f6f7f2] text-slate-800 md:flex">

      {/* Sidebar */}
      <aside className={`${mobileMenu ? 'block' : 'hidden'} fixed inset-y-0 left-0 z-40 w-72 border-r border-purple-100 bg-white p-6 shadow-xl md:sticky md:top-0 md:flex md:h-screen md:flex-col md:shadow-none`}>
        <div className="mb-9 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-800 text-white shadow-lg shadow-purple-200">
            <Store size={25} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-purple-950">WaseemTech</h1>
            <p className="text-[10px] font-bold tracking-[0.2em] text-lime-700">ADMIN CONTROL</p>
          </div>
          <button className="ml-auto md:hidden" onClick={() => setMobileMenu(false)}>
            <X size={21} />
          </button>
        </div>

        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Workspace
        </p>

        <nav className="space-y-1.5">
          {navItems.map(item => {
            const Icon = item.icon
            const active = tab === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id)
                  setSearch('')
                  setMobileMenu(false)
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  active
                    ? 'bg-purple-800 text-white shadow-lg shadow-purple-200'
                    : 'text-slate-500 hover:bg-lime-50 hover:text-purple-900'
                }`}
              >
                <Icon size={19} />
                {item.label}
                {item.id === 'payments' && analytics.pendingPayments > 0 && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20 text-white' : 'bg-lime-100 text-lime-900'}`}>
                    {analytics.pendingPayments}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto rounded-2xl bg-gradient-to-br from-purple-900 to-purple-700 p-4 text-white">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-white/15 p-2"><Store size={18} /></div>
            <span className="text-sm font-bold">Your Store</span>
          </div>
          <p className="text-xs leading-5 text-purple-100">
            Manage products, orders and customers from one place.
          </p>
          <button
            onClick={() => navigate('/shop')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-3 py-2.5 text-xs font-bold text-purple-950 hover:bg-lime-200"
          >
            <Eye size={15} /> Visit Store
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="mt-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-9">

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenu(true)}
              className="rounded-xl border border-slate-200 bg-white p-2.5 md:hidden"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-lime-700">
                WaseemTech Accessories
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-purple-950">
                {pageTitles[tab]}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage your online store with confidence.
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-purple-300 hover:text-purple-800"
          >
            <RefreshCw size={16} /> Refresh Data
          </button>
        </header>

        {/* Overview */}
        {tab === 'overview' && (
          <>
            <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950 via-purple-900 to-purple-800 p-6 text-white shadow-xl sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="max-w-xl">
                  <span className="inline-flex rounded-full bg-lime-300/15 px-3 py-1 text-xs font-bold text-lime-200">
                    STORE PERFORMANCE
                  </span>
                  <h3 className="mt-4 text-2xl font-extrabold sm:text-3xl">
                    Welcome to your control center.
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-purple-100">
                    Track your business performance and manage your store operations.
                  </p>
                  <button
                    onClick={() => setTab('products')}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-purple-950 hover:bg-lime-200"
                  >
                    <Package size={17} /> Manage Products
                  </button>
                </div>
                <div className="hidden h-32 w-32 items-center justify-center rounded-full border border-white/20 bg-white/10 sm:flex">
                  <BarChart3 size={65} className="text-lime-200" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Total Revenue" value={money(analytics.revenue)} subtitle="Excluding cancelled orders" icon={Wallet} color="purple" />
              <StatCard title="Total Orders" value={orders.length} subtitle="All order records" icon={ShoppingCart} color="green" />
              <StatCard title="Total Products" value={products.length} subtitle={`${products.filter(p => p.is_active).length} active products`} icon={Package} color="blue" />
              <StatCard title="Customers" value={customers.length} subtitle="Registered customers" icon={Users} color="orange" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard title="Pending Payments" value={analytics.pendingPayments} subtitle="Awaiting review" icon={CreditCard} color="orange" />
              <StatCard title="Average Order Value" value={money(analytics.averageOrder)} subtitle="Based on non-cancelled orders" icon={TrendingUp} color="green" />
              <StatCard title="Low Stock Products" value={analytics.lowStock.length} subtitle="Stock of 5 or fewer" icon={AlertTriangle} color="purple" />
            </div>

            {/* Daily Sales Chart */}
            <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Daily Sales</h3>
                    <p className="mt-1 text-xs text-slate-500">Last 7 days · Based on order totals</p>
                  </div>
                  <div className="rounded-xl bg-lime-100 p-2 text-lime-800"><TrendingUp size={19} /></div>
                </div>
                <div className="flex h-48 items-end gap-3">
                  {analytics.lastSevenDays.map((day, index) => (
                    <div key={`${day.label}-${index}`} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-[10px] font-semibold text-slate-500">
                        {day.total ? `${Math.round(day.total / 1000)}k` : '0'}
                      </span>
                      <div className="flex h-36 w-full items-end overflow-hidden rounded-t-lg bg-purple-50">
                        <div
                          className="w-full rounded-t-lg bg-gradient-to-t from-purple-800 to-purple-500 transition-all"
                          style={{ height: `${Math.max((day.total / analytics.maxDaily) * 100, day.total ? 5 : 0)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-500">{day.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Monthly Sales */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Monthly Sales</h3>
                    <p className="mt-1 text-xs text-slate-500">Last 6 months</p>
                  </div>
                  <div className="rounded-xl bg-purple-100 p-2 text-purple-800"><BarChart3 size={19} /></div>
                </div>
                <div className="space-y-4">
                  {analytics.monthly.map((month, index) => (
                    <div key={`${month.label}-${index}`}>
                      <div className="mb-1.5 flex justify-between text-xs">
                        <span className="font-semibold text-slate-600">{month.label}</span>
                        <span className="font-bold text-slate-800">{money(month.total)}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-800 to-lime-500"
                          style={{ width: `${(month.total / analytics.maxMonthly) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Order Status and Low Stock */}
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-900">Order Status Breakdown</h3>
                <p className="mb-5 mt-1 text-xs text-slate-500">Current order distribution</p>
                <div className="space-y-3">
                  {analytics.statusCounts.map(item => (
                    <div key={item.status} className="flex items-center gap-3">
                      <span className="w-24 text-xs capitalize text-slate-600">{item.status}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-purple-700"
                          style={{ width: `${orders.length ? (item.count / orders.length) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-7 text-right text-xs font-bold text-slate-700">{item.count}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Low Stock Alerts</h3>
                    <p className="mt-1 text-xs text-slate-500">Products needing attention</p>
                  </div>
                  <AlertTriangle className="text-orange-500" size={21} />
                </div>
                {analytics.lowStock.length ? (
                  <div className="space-y-3">
                    {analytics.lowStock.slice(0, 5).map(product => (
                      <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl bg-orange-50 p-3">
                        <span className="truncate text-sm font-semibold text-slate-700">{product.name}</span>
                        <span className="shrink-0 rounded-lg bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-800">
                          {product.stock} left
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-lime-50 p-4 text-sm text-lime-800">
                    All products have more than 5 items in stock.
                  </p>
                )}
              </section>
            </div>

            {/* Recent Orders */}
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">Recent Orders</h3>
                  <p className="mt-1 text-xs text-slate-500">Latest customer orders</p>
                </div>
                <button onClick={() => setTab('orders')} className="text-xs font-bold text-purple-800 hover:underline">
                  View all
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[550px] text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs text-slate-400">
                    <tr>
                      <th className="pb-3">Order ID</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map(order => (
                      <tr key={order.id} className="border-b border-slate-50">
                        <td className="py-3 font-semibold text-slate-700">{order.order_number || order.id.slice(0, 8)}</td>
                        <td className="py-3 text-slate-500">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</td>
                        <td className="py-3 font-semibold">{money(order.total_amount)}</td>
                        <td className="py-3"><StatusBadge value={order.order_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!orders.length && <p className="py-5 text-sm text-slate-500">No orders yet.</p>}
              </div>
            </section>
          </>
        )}

        {/* Products */}
        {tab === 'products' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeading
              title={`All Products (${products.length})`}
              description="Add, update and manage your store inventory."
              action={
                <button onClick={openAddForm} className="flex items-center gap-2 rounded-xl bg-purple-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-700">
                  <Plus size={17} /> Add Product
                </button>
              }
            />
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-3 text-slate-400" size={17} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-purple-500" />
              </div>
              <button onClick={() => exportCSV(products, 'waseemtech-products.csv')} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">
                <Download size={16} /> Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-400">
                  <tr><th className="pb-3">Product</th><th className="pb-3">Price</th><th className="pb-3">Stock</th><th className="pb-3">Status</th><th className="pb-3">Actions</th></tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr key={product.id} className="border-b border-slate-50">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          {product.image_url ? <img src={product.image_url} alt={product.name} className="h-11 w-11 rounded-xl object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-purple-700"><Package size={19} /></div>}
                          <div>
                            <p className="font-semibold text-slate-800">{product.name}</p>
                            {product.is_featured && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-lime-700"><Star size={10} /> Featured</span>}
                          </div>
                        </div>
                      </td>
                      <td className="font-semibold">{money(product.price)}</td>
                      <td>
                        <span className={Number(product.stock) <= 5 ? 'font-bold text-orange-600' : 'text-slate-600'}>{product.stock}</span>
                      </td>
                      <td><StatusBadge value={product.is_active ? 'approved' : 'rejected'} /></td>
                      <td>
                        <div className="flex gap-3">
                          <button onClick={() => openEditForm(product)} className="text-purple-700 hover:text-purple-950" aria-label="Edit product"><Edit size={17} /></button>
                          <button onClick={() => deleteProduct(product.id)} className="text-red-500 hover:text-red-700" aria-label="Delete product"><Trash2 size={17} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredProducts.length && <p className="py-8 text-center text-sm text-slate-500">No matching products found.</p>}
            </div>
          </section>
        )}

        {/* Categories */}
        {tab === 'categories' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeading
              title={`Categories (${categories.length})`}
              description="Organize products into store categories."
              action={<button onClick={addCategory} className="flex items-center gap-2 rounded-xl bg-purple-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-700"><Plus size={17} /> Add Category</button>}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {categories.map(category => {
                const count = products.filter(product => product.category_id === category.id).length
                return (
                  <div key={category.id} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <div className="rounded-xl bg-purple-100 p-3 text-purple-800"><Tags size={22} /></div>
                    <div>
                      <h3 className="font-bold text-slate-800">{category.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">{count} products</p>
                    </div>
                  </div>
                )
              })}
            </div>
            {!categories.length && <p className="py-8 text-center text-sm text-slate-500">No categories found.</p>}
          </section>
        )}

        {/* Orders */}
        {tab === 'orders' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeading title="Customer Orders" description="Search orders and update their fulfilment status." action={<button onClick={() => exportCSV(orders, 'waseemtech-orders.csv')} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"><Download size={16} /> Export CSV</button>} />
            <div className="mb-5 flex flex-wrap gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-3 text-slate-400" size={17} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order number..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-purple-500" />
              </div>
              <select value={orderFilter} onChange={e => setOrderFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <option value="all">All statuses</option>
                {orderStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-400"><tr><th className="pb-3">Order</th><th className="pb-3">Date</th><th className="pb-3">Amount</th><th className="pb-3">Payment</th><th className="pb-3">Order Status</th><th className="pb-3">Update</th></tr></thead>
                <tbody>
                  {filteredOrders.map(order => (
                    <tr key={order.id} className="border-b border-slate-50">
                      <td className="py-3 font-semibold">{order.order_number || order.id.slice(0, 8)}</td>
                      <td className="text-slate-500">{order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</td>
                      <td className="font-semibold">{money(order.total_amount)}</td>
                      <td><StatusBadge value={order.payment_status} /></td>
                      <td><StatusBadge value={order.order_status} /></td>
                      <td>
                        <select value={order.order_status || 'pending'} onChange={e => updateOrderStatus(order.id, e.target.value)} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
                          {orderStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredOrders.length && <p className="py-8 text-center text-sm text-slate-500">No matching orders found.</p>}
            </div>
          </section>
        )}

        {/* Payments */}
        {tab === 'payments' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeading title="Payment Reviews" description="Review customer payment submissions." action={<button onClick={() => exportCSV(payments, 'waseemtech-payments.csv')} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"><Download size={16} /> Export CSV</button>} />
            <div className="mb-5 flex flex-wrap gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-3 text-slate-400" size={17} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transaction..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-purple-500" />
              </div>
              <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <option value="all">All payments</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-400"><tr><th className="pb-3">Transaction</th><th className="pb-3">Method</th><th className="pb-3">Amount</th><th className="pb-3">Status</th><th className="pb-3">Review Actions</th></tr></thead>
                <tbody>
                  {filteredPayments.map(payment => (
                    <tr key={payment.id} className="border-b border-slate-50">
                      <td className="py-3 font-semibold">{payment.transaction_id || 'Not provided'}</td>
                      <td>{payment.payment_method || '—'}</td>
                      <td className="font-semibold">{money(payment.amount)}</td>
                      <td><StatusBadge value={payment.status} /></td>
                      <td>
                        {payment.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button onClick={() => updatePaymentStatus(payment.id, 'approved')} className="rounded-lg bg-lime-100 px-3 py-1.5 text-xs font-bold text-lime-800 hover:bg-lime-200">Approve</button>
                            <button onClick={() => updatePaymentStatus(payment.id, 'rejected')} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200">Reject</button>
                          </div>
                        ) : <span className="text-xs text-slate-400">Reviewed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredPayments.length && <p className="py-8 text-center text-sm text-slate-500">No matching payments found.</p>}
            </div>
          </section>
        )}

        {/* Customers */}
        {tab === 'customers' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeading title={`Registered Customers (${customers.length})`} description="Search your registered customer directory." action={<button onClick={() => exportCSV(customers, 'waseemtech-customers.csv')} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"><Download size={16} /> Export CSV</button>} />
            <div className="relative mb-5">
              <Search className="absolute left-3 top-3 text-slate-400" size={17} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or phone..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-purple-500" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-400"><tr><th className="pb-3">Customer</th><th className="pb-3">Email</th><th className="pb-3">Phone</th><th className="pb-3">City</th></tr></thead>
                <tbody>
                  {filteredCustomers.map(customer => (
                    <tr key={customer.id} className="border-b border-slate-50">
                      <td className="py-3 font-semibold">{customer.full_name || 'Customer'}</td>
                      <td>{customer.email || '—'}</td>
                      <td>{customer.phone || '—'}</td>
                      <td>{customer.city || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredCustomers.length && <p className="py-8 text-center text-sm text-slate-500">No matching customers found.</p>}
            </div>
          </section>
        )}

        <footer className="mt-9 border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
          WaseemTech Accessories · Admin Dashboard
        </footer>
      </main>

      {/* Add/Edit Product Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={saveProduct} className="my-8 w-full max-w-2xl space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-lime-700">Product Management</p>
                <h3 className="mt-1 text-2xl font-extrabold text-purple-950">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"><X size={20} /></button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">Product Name *</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter product name" className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">Category</label>
              <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-purple-500">
                <option value="">Select category (optional)</option>
                {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Write product description..." rows={3} className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-purple-500" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">Price (Rs.) *</label>
                <input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Price" className="w-full min-w-0 rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">Old Price</label>
                <input type="number" min="0" step="0.01" value={form.old_price} onChange={e => setForm({ ...form, old_price: e.target.value })} placeholder="Old price" className="w-full min-w-0 rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">Stock *</label>
                <input required type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="Quantity" className="w-full min-w-0 rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-purple-500" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">Product Image URL</label>
              <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-purple-500" />
            </div>

            <div className="flex flex-wrap gap-5 rounded-xl bg-slate-50 p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.is_featured} onChange={e => setForm({ ...form, is_featured: e.target.checked })} className="h-4 w-4 accent-purple-800" />
                Featured product
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-purple-800" />
                Active in store
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-purple-800 px-4 py-3 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update Product' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
