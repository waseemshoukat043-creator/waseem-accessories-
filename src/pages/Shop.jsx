
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  ShoppingCart,
  Heart,
  Package,
  LayoutDashboard
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export default function Shop() {
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    loadProducts()
    loadCategories()
    checkAdminRole()
  }, [])

  // Check logged-in user's role
  async function checkAdminRole() {
    try {
      const { data: { user }, error: userError } =
        await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        setIsAdmin(false)
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setIsAdmin(profile?.role === 'admin')
    } catch (error) {
      console.error('Role check error:', error.message)
      setIsAdmin(false)
    }
  }

  // Fetch products
  async function loadProducts() {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      setProducts(data || [])
    } catch (error) {
      console.error('Products error:', error)
      toast.error(error.message || 'Unable to load products')
    } finally {
      setLoading(false)
    }
  }

  // Fetch categories
  async function loadCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error

      setCategories(data || [])
    } catch (error) {
      console.error('Categories error:', error)
    }
  }

  // Add product to cart
  async function addToCart(product) {
    try {
      const { data: { user }, error: userError } =
        await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        toast.error('Please login first')
        navigate('/login')
        return
      }

      const stock = Number(product.stock || 0)

      if (stock <= 0) {
        toast.error('Product is out of stock')
        return
      }

      const { data: existingItem, error: fetchError } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (existingItem) {
        const newQuantity = Number(existingItem.quantity) + 1

        if (newQuantity > stock) {
          toast.error('Not enough stock available')
          return
        }

        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: newQuantity })
          .eq('id', existingItem.id)
          .eq('user_id', user.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: product.id,
            quantity: 1
          })

        if (error) throw error
      }

      toast.success('Product added to cart!')
    } catch (error) {
      console.error('Add to cart error:', error)
      toast.error(error.message || 'Could not add product to cart')
    }
  }

  // Add product to wishlist
  async function addToWishlist(product) {
    try {
      const { data: { user }, error: userError } =
        await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        toast.error('Please login first')
        navigate('/login')
        return
      }

      const { data: existingItem, error: fetchError } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (existingItem) {
        toast('Already in your wishlist')
        return
      }

      const { error } = await supabase
        .from('wishlist')
        .insert({
          user_id: user.id,
          product_id: product.id
        })

      if (error) throw error

      toast.success('Added to wishlist!')
    } catch (error) {
      console.error('Wishlist error:', error)
      toast.error(error.message || 'Could not add to wishlist')
    }
  }

  // Search and category filters
  const filteredProducts = products.filter((product) => {
    const searchText = search.toLowerCase()

    const matchesSearch =
      product.name?.toLowerCase().includes(searchText) ||
      product.description?.toLowerCase().includes(searchText)

    const matchesCategory =
      selectedCategory === 'all' ||
      String(product.category_id) === String(selectedCategory)

    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">

          <Link to="/" className="text-2xl font-extrabold text-orange-600">
            WaseemTech
            <span className="text-gray-800"> Accessories</span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">

            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white transition hover:bg-orange-700"
              >
                <LayoutDashboard size={18} />
                Back to Dashboard
              </button>
            )}

            <Link
              to="/cart"
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-gray-700 transition hover:border-orange-500 hover:text-orange-600"
            >
              <ShoppingCart size={18} />
              Cart
            </Link>

            <Link
              to="/wishlist"
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-gray-700 transition hover:border-orange-500 hover:text-orange-600"
            >
              <Heart size={18} />
              Wishlist
            </Link>

          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-10">

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 md:text-4xl">
            Explore Our Products
          </h1>

          <p className="mt-2 text-gray-500">
            Discover quality tech accessories at great prices.
          </p>
        </div>

        {/* Search and Category */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row">

          <div className="relative flex-1">
            <Search
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-12 pr-4 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-orange-500"
          >
            <option value="all">All Categories</option>

            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

        </div>

        {/* Product Listing */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
            <p className="mt-4 text-gray-500">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-white py-20 text-center shadow-sm">
            <Package size={48} className="mx-auto text-gray-300" />

            <h2 className="mt-4 text-xl font-bold text-gray-800">
              No Products Found
            </h2>

            <p className="mt-2 text-gray-500">
              Try another search or category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >

                <div className="relative flex h-56 items-center justify-center bg-gray-100">

                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package size={55} className="text-gray-300" />
                  )}

                  <button
                    type="button"
                    onClick={() => addToWishlist(product)}
                    aria-label="Add to wishlist"
                    className="absolute right-3 top-3 rounded-full bg-white p-3 text-gray-600 shadow-md transition hover:bg-red-50 hover:text-red-500"
                  >
                    <Heart size={19} />
                  </button>

                  {Number(product.stock || 0) <= 0 && (
                    <span className="absolute bottom-3 left-3 rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white">
                      Out of Stock
                    </span>
                  )}

                </div>

                <div className="p-5">

                  <h2 className="truncate text-lg font-bold text-gray-900">
                    {product.name}
                  </h2>

                  <p className="mt-2 line-clamp-2 min-h-10 text-sm text-gray-500">
                    {product.description || 'Quality tech accessory.'}
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xl font-extrabold text-orange-600">
                      Rs. {Number(product.price || 0).toLocaleString('en-PK')}
                    </span>

                    <span className="text-xs text-gray-500">
                      Stock: {product.stock ?? 0}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={Number(product.stock || 0) <= 0}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    <ShoppingCart size={18} />
                    {Number(product.stock || 0) <= 0
                      ? 'Out of Stock'
                      : 'Add to Cart'}
                  </button>

                </div>
              </div>
            ))}

          </div>
        )}

      </main>
    </div>
  )
}
