
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  ShoppingCart,
  Heart,
  Package,
  LayoutDashboard,
  SlidersHorizontal,
  X,
  Eye,
  ArrowUpDown,
  RefreshCw,
  Check,
  Star,
  ShoppingBag
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

const PRODUCTS_PER_PAGE = 8

const formatPrice = (price) =>
  Number(price || 0).toLocaleString('en-PK')

export default function Shop() {
  const navigate = useNavigate()

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [wishlistIds, setWishlistIds] = useState([])
  const [addingProduct, setAddingProduct] = useState(null)

  useEffect(() => {
    loadProducts()
    loadCategories()
    checkAdminRole()
    loadWishlist()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [
    search,
    selectedCategory,
    sortBy,
    minPrice,
    maxPrice,
    inStockOnly,
    featuredOnly
  ])

  // Check admin role
  async function checkAdminRole() {
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

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

  // Load products
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

  // Load categories
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

  // Load user's wishlist
  async function loadWishlist() {
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) return

      const { data, error } = await supabase
        .from('wishlist')
        .select('product_id')
        .eq('user_id', user.id)

      if (error) throw error

      setWishlistIds((data || []).map(item => String(item.product_id)))
    } catch (error) {
      console.error('Wishlist loading error:', error)
    }
  }

  // Add product to cart
  async function addToCart(product) {
    try {
      setAddingProduct(product.id)

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

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
    } finally {
      setAddingProduct(null)
    }
  }

  // Add or remove wishlist item
  async function toggleWishlist(product) {
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        toast.error('Please login first')
        navigate('/login')
        return
      }

      const alreadySaved = wishlistIds.includes(String(product.id))

      if (alreadySaved) {
        const { error } = await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id)

        if (error) throw error

        setWishlistIds(prev =>
          prev.filter(id => id !== String(product.id))
        )

        toast.success('Removed from wishlist')
      } else {
        const { error } = await supabase
          .from('wishlist')
          .insert({
            user_id: user.id,
            product_id: product.id
          })

        if (error) throw error

        setWishlistIds(prev => [...prev, String(product.id)])
        toast.success('Added to wishlist!')
      }
    } catch (error) {
      console.error('Wishlist error:', error)
      toast.error(error.message || 'Could not update wishlist')
    }
  }

  // Apply search, filters and sorting
  const filteredProducts = useMemo(() => {
    let result = [...products]

    const searchText = search.trim().toLowerCase()

    if (searchText) {
      result = result.filter(product =>
        product.name?.toLowerCase().includes(searchText) ||
        product.description?.toLowerCase().includes(searchText)
      )
    }

    if (selectedCategory !== 'all') {
      result = result.filter(
        product =>
          String(product.category_id) === String(selectedCategory)
      )
    }

    if (minPrice !== '') {
      result = result.filter(
        product => Number(product.price) >= Number(minPrice)
      )
    }

    if (maxPrice !== '') {
      result = result.filter(
        product => Number(product.price) <= Number(maxPrice)
      )
    }

    if (inStockOnly) {
      result = result.filter(product => Number(product.stock || 0) > 0)
    }

    if (featuredOnly) {
      result = result.filter(product => product.is_featured === true)
    }

    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => Number(a.price) - Number(b.price))
        break

      case 'price-high':
        result.sort((a, b) => Number(b.price) - Number(a.price))
        break

      case 'name':
        result.sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        )
        break

      case 'newest':
      default:
        result.sort(
          (a, b) =>
            new Date(b.created_at || 0) - new Date(a.created_at || 0)
        )
        break
    }

    return result
  }, [
    products,
    search,
    selectedCategory,
    minPrice,
    maxPrice,
    inStockOnly,
    featuredOnly,
    sortBy
  ])

  // Pagination
  const totalPages = Math.ceil(
    filteredProducts.length / PRODUCTS_PER_PAGE
  )

  const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE

  const visibleProducts = filteredProducts.slice(
    startIndex,
    startIndex + PRODUCTS_PER_PAGE
  )

  // Reset filters
  function resetFilters() {
    setSearch('')
    setSelectedCategory('all')
    setSortBy('newest')
    setMinPrice('')
    setMaxPrice('')
    setInStockOnly(false)
    setFeaturedOnly(false)
    setCurrentPage(1)
  }

  return (
    <div className="min-h-screen bg-[#f7f8f5] text-gray-900">

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">

          <Link to="/" className="text-2xl font-extrabold tracking-tight text-purple-800">
            WaseemTech<span className="text-emerald-600">.</span>
            <span className="ml-1 text-sm font-medium text-gray-500">
              Accessories
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">

            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 rounded-xl bg-purple-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-purple-900"
              >
                <LayoutDashboard size={17} />
                Dashboard
              </button>
            )}

            <Link
              to="/cart"
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold transition hover:border-emerald-500 hover:text-emerald-700"
            >
              <ShoppingCart size={18} />
              Cart
            </Link>

            <Link
              to="/wishlist"
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold transition hover:border-emerald-500 hover:text-emerald-700"
            >
              <Heart size={18} />
              Wishlist
            </Link>

          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-r from-purple-950 via-purple-900 to-emerald-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[3px] text-emerald-300">
            Technology made simple
          </p>

          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">
            Discover Your Next
            <span className="block text-emerald-300">Tech Essential.</span>
          </h1>

          <p className="mt-5 max-w-xl leading-7 text-purple-100">
            Explore quality mobile, laptop and smart accessories
            designed for your everyday lifestyle.
          </p>

          <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm">
            <ShoppingBag size={16} className="text-emerald-300" />
            {products.length} products available
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-10">

        {/* Page heading */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-700">
              Our Collection
            </p>

            <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
              Shop Accessories
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Find the right accessories for your technology.
            </p>
          </div>

          <button
            onClick={loadProducts}
            type="button"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-purple-400"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Search */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row">

            <div className="relative flex-1">
              <Search
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="search"
                placeholder="Search products by name or description..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 outline-none transition focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-100"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-purple-500"
            >
              <option value="all">All Categories</option>

              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-purple-500"
            >
              <option value="newest">Newest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name: A to Z</option>
            </select>

          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-2 lg:grid-cols-4">

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Minimum Price (Rs.)
            </label>

            <input
              type="number"
              min="0"
              placeholder="e.g. 1000"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Maximum Price (Rs.)
            </label>

            <input
              type="number"
              min="0"
              placeholder="e.g. 10000"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-purple-500"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl bg-gray-50 p-3">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={e => setInStockOnly(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />

            <span className="text-sm font-semibold text-gray-700">
              In-stock products only
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl bg-gray-50 p-3">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={e => setFeaturedOnly(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />

            <span className="text-sm font-semibold text-gray-700">
              Featured products only
            </span>
          </label>

          <div className="flex items-center justify-between gap-3 md:col-span-2 lg:col-span-4">
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <SlidersHorizontal size={16} />
              {filteredProducts.length} matching products
            </p>

            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-900"
            >
              <RefreshCw size={15} />
              Clear Filters
            </button>
          </div>
        </div>

        {/* Products */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse overflow-hidden rounded-2xl border border-gray-100 bg-white"
              >
                <div className="h-56 bg-gray-200" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-3/4 rounded bg-gray-200" />
                  <div className="h-4 w-full rounded bg-gray-100" />
                  <div className="h-8 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-20 text-center shadow-sm">
            <Package size={55} className="mx-auto text-gray-300" />

            <h3 className="mt-5 text-xl font-bold text-gray-800">
              No Products Found
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              Try changing your search or filters.
            </p>

            <button
              onClick={resetFilters}
              className="mt-6 rounded-xl bg-purple-800 px-6 py-3 font-semibold text-white hover:bg-purple-900"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                Available Products
              </h3>

              <span className="text-sm text-gray-500">
                Showing {startIndex + 1}–
                {Math.min(startIndex + PRODUCTS_PER_PAGE, filteredProducts.length)}
                {' '}of {filteredProducts.length}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

              {visibleProducts.map(product => {
                const isWishlisted = wishlistIds.includes(String(product.id))
                const outOfStock = Number(product.stock || 0) <= 0

                return (
                  <article
                    key={product.id}
                    className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl"
                  >
                    <div className="relative flex h-60 items-center justify-center overflow-hidden bg-gray-100">

                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <Package size={60} className="text-gray-300" />
                      )}

                      {product.is_featured && (
                        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-purple-800 px-3 py-1.5 text-xs font-bold text-white">
                          <Star size={12} />
                          Featured
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleWishlist(product)}
                        aria-label="Toggle wishlist"
                        className={`absolute right-3 top-3 rounded-full p-3 shadow-md transition ${
                          isWishlisted
                            ? 'bg-red-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-500'
                        }`}
                      >
                        <Heart
                          size={18}
                          fill={isWishlisted ? 'currentColor' : 'none'}
                        />
                      </button>

                      <span
                        className={`absolute bottom-3 left-3 rounded-lg px-3 py-1.5 text-xs font-bold text-white ${
                          outOfStock ? 'bg-red-600' : 'bg-emerald-700'
                        }`}
                      >
                        {outOfStock ? 'Out of Stock' : 'In Stock'}
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-gray-800 opacity-0 shadow-md transition group-hover:opacity-100"
                      >
                        <Eye size={15} />
                        Quick View
                      </button>
                    </div>

                    <div className="p-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                        {categories.find(
                          category =>
                            String(category.id) === String(product.category_id)
                        )?.name || 'Tech Accessories'}
                      </p>

                      <h3 className="mt-2 truncate text-lg font-bold text-gray-900">
                        {product.name}
                      </h3>

                      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-gray-500">
                        {product.description || 'Quality tech accessory.'}
                      </p>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xl font-extrabold text-purple-800">
                          Rs. {formatPrice(product.price)}
                        </span>

                        <span className="text-xs text-gray-500">
                          Stock: {product.stock ?? 0}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        disabled={outOfStock || addingProduct === product.id}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-800 py-3 font-semibold text-white transition hover:bg-purple-900 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {addingProduct === product.id ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <ShoppingCart size={18} />
                            {outOfStock ? 'Out of Stock' : 'Add to Cart'}
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                )
              })}

            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
                  <button
                    type="button"
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-10 w-10 rounded-lg text-sm font-bold transition ${
                      currentPage === page
                        ? 'bg-purple-800 text-white'
                        : 'border border-gray-200 bg-white text-gray-700 hover:border-purple-500'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Quick View Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Product quick view"
            className="relative my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              aria-label="Close quick view"
              className="absolute right-4 top-4 z-10 rounded-full bg-white p-2 shadow-md hover:bg-gray-100"
            >
              <X size={20} />
            </button>

            <div className="grid md:grid-cols-2">
              <div className="flex min-h-64 items-center justify-center bg-gray-100">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="h-full max-h-96 w-full object-cover"
                  />
                ) : (
                  <Package size={75} className="text-gray-300" />
                )}
              </div>

              <div className="flex flex-col justify-center p-7">
                <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">
                  Product Details
                </p>

                <h2 className="mt-3 text-2xl font-extrabold text-gray-900">
                  {selectedProduct.name}
                </h2>

                <p className="mt-4 leading-7 text-gray-500">
                  {selectedProduct.description || 'Quality tech accessory.'}
                </p>

                <p className="mt-6 text-3xl font-extrabold text-purple-800">
                  Rs. {formatPrice(selectedProduct.price)}
                </p>

                <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                  <Check size={16} className="text-emerald-600" />
                  {Number(selectedProduct.stock || 0) > 0
                    ? `${selectedProduct.stock} units available`
                    : 'Currently out of stock'}
                </p>

                <button
                  type="button"
                  disabled={Number(selectedProduct.stock || 0) <= 0}
                  onClick={() => addToCart(selectedProduct)}
                  className="mt-7 flex items-center justify-center gap-2 rounded-xl bg-purple-800 py-3 font-bold text-white hover:bg-purple-900 disabled:bg-gray-300"
                >
                  <ShoppingCart size={18} />
                  Add to Cart
                </button>

                <button
                  type="button"
                  onClick={() => toggleWishlist(selectedProduct)}
                  className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 font-semibold text-gray-700 hover:border-emerald-500"
                >
                  <Heart
                    size={18}
                    fill={
                      wishlistIds.includes(String(selectedProduct.id))
                        ? 'currentColor'
                        : 'none'
                    }
                  />
                  {wishlistIds.includes(String(selectedProduct.id))
                    ? 'Remove from Wishlist'
                    : 'Add to Wishlist'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-8 sm:flex-row">
          <div>
            <h3 className="text-xl font-extrabold text-purple-800">
              WaseemTech<span className="text-emerald-600">.</span>
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Your destination for quality tech accessories.
            </p>
          </div>

          <p className="self-center text-sm text-gray-500">
            © 2026 WaseemTech Accessories. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
