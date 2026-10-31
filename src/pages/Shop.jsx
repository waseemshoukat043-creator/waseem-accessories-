
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, ShoppingCart, Heart, ArrowLeft, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export default function Shop() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) toast.error(error.message)
    else setProducts(data || [])

    setLoading(false)
  }

  async function addToCart(product) {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Please login to add products to cart')
      navigate('/login')
      return
    }

    const { data: existing, error: findError } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('product_id', product.id)
      .maybeSingle()

    if (findError) {
      toast.error(findError.message)
      return
    }

    if ((existing?.quantity || 0) >= product.stock) {
      toast.error('Available stock limit reached')
      return
    }

    const result = existing
      ? await supabase.from('cart_items')
          .update({ quantity: existing.quantity + 1 })
          .eq('id', existing.id)
      : await supabase.from('cart_items').insert({
          user_id: user.id,
          product_id: product.id,
          quantity: 1
        })

    if (result.error) toast.error(result.error.message)
    else toast.success('Added to cart')
  }

  async function addToWishlist(product) {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Please login to use wishlist')
      navigate('/login')
      return
    }

    const { error } = await supabase.from('wishlist').insert({
      user_id: user.id,
      product_id: product.id
    })

    if (error?.code === '23505') {
      toast('Already in your wishlist')
      return
    }

    if (error) toast.error(error.message)
    else toast.success('Added to wishlist')
  }

  const categories = [
    'all',
    ...new Set(products.map(p => p.category_id).filter(Boolean))
  ]

  const filtered = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'all' || product.category_id === category
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900 px-5 py-5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="text-2xl font-bold text-blue-400">
            WaseemTech
          </Link>

          <div className="flex gap-3">
            <Link to="/cart" className="flex items-center gap-2 bg-zinc-800 px-4 py-2 rounded-lg">
              <ShoppingCart size={18} /> Cart
            </Link>
            <Link to="/wishlist" className="flex items-center gap-2 bg-zinc-800 px-4 py-2 rounded-lg">
              <Heart size={18} /> Wishlist
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 py-10">
        <div className="mb-8">
          <p className="text-blue-400 text-sm font-semibold">OUR COLLECTION</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">Explore Products</h1>
          <p className="text-zinc-400 mt-2">Discover quality tech accessories at great prices.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 flex-1">
            <Search size={19} className="text-zinc-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="bg-transparent outline-none py-3 w-full"
            />
          </div>

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
          >
            <option value="all">All Categories</option>
            {categories.filter(c => c !== 'all').map(id => (
              <option key={id} value={id}>
                {products.find(p => p.category_id === id)?.name
                  ? products.find(p => p.category_id === id)?.category_id
                  : id}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-center py-20 text-zinc-400">Loading products...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package size={45} className="mx-auto text-zinc-600 mb-4" />
            <h2 className="text-xl font-semibold">No products found</h2>
            <p className="text-zinc-400 mt-2">Try another search or add products from Admin Dashboard.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(product => (
              <article key={product.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-blue-500/60 transition">
                <div className="relative bg-zinc-800 aspect-square">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-zinc-600">
                      <Package size={55} />
                    </div>
                  )}
                  <button
                    onClick={() => addToWishlist(product)}
                    className="absolute top-3 right-3 bg-black/70 p-3 rounded-full hover:text-red-400"
                    aria-label="Add to wishlist"
                  >
                    <Heart size={19} />
                  </button>
                </div>

                <div className="p-5">
                  <h3 className="font-semibold text-lg">{product.name}</h3>
                  <p className="text-zinc-400 text-sm mt-2 line-clamp-2">
                    {product.description || 'Quality tech accessory.'}
                  </p>

                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-xl font-bold text-blue-400">
                      Rs. {Number(product.price).toLocaleString('en-PK')}
                    </span>
                    {product.old_price && (
                      <span className="text-sm text-zinc-500 line-through">
                        Rs. {Number(product.old_price).toLocaleString('en-PK')}
                      </span>
                    )}
                  </div>

                  <p className={`text-xs mt-2 ${product.stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                  </p>

                  <button
                    disabled={product.stock <= 0}
                    onClick={() => addToCart(product)}
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 rounded-xl py-3 flex justify-center items-center gap-2 font-semibold"
                  >
                    <ShoppingCart size={18} /> Add to Cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
