
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Heart,
  Trash2,
  ShoppingBag,
  ArrowLeft,
  Package,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export default function Wishlist() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const navigate = useNavigate()

  async function loadWishlist(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!user) {
        navigate('/login')
        return
      }

      const { data, error } = await supabase
        .from('wishlist')
        .select(`
          id,
          products (
            id,
            name,
            price,
            image_url,
            stock
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      setItems(data || [])
    } catch (error) {
      toast.error(error.message || 'Could not load wishlist')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadWishlist()
  }, [])

  async function removeItem(id) {
    setRemovingId(id)

    try {
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!user) {
        navigate('/login')
        return
      }

      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      setItems(current => current.filter(item => item.id !== id))
      toast.success('Removed from wishlist')
    } catch (error) {
      toast.error(error.message || 'Could not remove item')
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F9F6] flex items-center justify-center px-5">
        <div className="text-center">
          <div className="w-11 h-11 border-4 border-[#5B3A8E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#716B7B] font-medium">
            Loading your wishlist...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F8F9F6] text-[#24212B] px-5 py-10">
      <div className="max-w-6xl mx-auto">

        {/* TOP NAVIGATION */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-[#5B3A8E] hover:text-[#482B75] font-semibold text-sm transition"
          >
            <ArrowLeft size={18} />
            Continue Shopping
          </Link>

          <button
            onClick={() => loadWishlist(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#716B7B] hover:text-[#5B3A8E] disabled:opacity-50 transition"
          >
            <RefreshCw
              size={16}
              className={refreshing ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>

        {/* PAGE HEADER */}
        <section className="bg-[#5B3A8E] text-white rounded-2xl p-7 md:p-9 mb-8 overflow-hidden relative">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/15 grid place-items-center">
                <Heart size={25} className="text-white" />
              </div>

              <span className="text-white/80 text-xs font-bold tracking-[0.2em] uppercase">
                LAPMOB COLLECTION
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white">
              My Wishlist
            </h1>

            <p className="text-white/80 mt-2 max-w-xl">
              Your favourite tech products, saved in one place.
              Keep track of the products you love.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 bg-white/15 text-white px-4 py-2 rounded-full text-sm font-semibold">
              <Heart size={16} />
              {items.length} {items.length === 1 ? 'Product' : 'Products'} Saved
            </div>
          </div>

          <Heart
            size={150}
            className="absolute -right-5 -bottom-8 text-white/10"
          />
        </section>

        {/* EMPTY STATE */}
        {items.length === 0 ? (
          <div className="bg-white border border-[#E8E3ED] rounded-2xl shadow-sm px-6 py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-[#EDE5F7] text-[#5B3A8E] grid place-items-center mx-auto mb-5">
              <Heart size={38} />
            </div>

            <h2 className="text-2xl font-extrabold text-[#24212B]">
              Your Wishlist is Empty
            </h2>

            <p className="text-[#716B7B] mt-3 max-w-md mx-auto">
              You haven't saved any products yet. Explore our collection
              and add your favourite products to your wishlist.
            </p>

            <Link
              to="/shop"
              className="inline-flex items-center gap-2 mt-7 bg-[#5B3A8E] hover:bg-[#482B75] text-white px-7 py-3 rounded-xl font-bold transition"
            >
              <ShoppingBag size={18} />
              Explore Products
            </Link>
          </div>
        ) : (
          <>
            {/* SECTION HEADING */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-[#24212B]">
                  Saved Products
                </h2>
                <p className="text-sm text-[#716B7B] mt-1">
                  Products you have added to your wishlist.
                </p>
              </div>
            </div>

            {/* PRODUCTS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {items.map(item => {
                const product = item.products
                const inStock =
                  product && Number(product.stock || 0) > 0

                return (
                  <article
                    key={item.id}
                    className="group bg-white border border-[#E8E3ED] rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    {/* PRODUCT IMAGE */}
                    <div className="relative bg-[#F5F3F7] aspect-square overflow-hidden">
                      {product?.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name || 'Product'}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#9A94A2]">
                          <Package size={55} />
                        </div>
                      )}

                      {/* WISHLIST ICON */}
                      <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center">
                        <Heart size={19} className="text-red-500 fill-red-500" />
                      </div>

                      {/* STOCK BADGE */}
                      <div className={`absolute bottom-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                        inStock
                          ? 'bg-[#EAF5E8] text-[#287443]'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {inStock ? (
                          <>
                            <CheckCircle2 size={13} />
                            In Stock
                          </>
                        ) : (
                          <>
                            <AlertCircle size={13} />
                            Out of Stock
                          </>
                        )}
                      </div>
                    </div>

                    {/* PRODUCT DETAILS */}
                    <div className="p-5">
                      <h2 className="font-bold text-[#24212B] text-base line-clamp-2 min-h-12">
                        {product?.name || 'Product Unavailable'}
                      </h2>

                      <div className="flex items-center justify-between mt-3">
                        <div>
                          <p className="text-xs text-[#9A94A2]">
                            Price
                          </p>
                          <p className="text-xl font-extrabold text-[#5B3A8E] mt-1">
                            Rs. {Number(product?.price || 0).toLocaleString('en-PK')}
                          </p>
                        </div>

                        {inStock && (
                          <span className="text-xs text-[#716B7B]">
                            {product.stock} available
                          </span>
                        )}
                      </div>

                      {/* ACTIONS */}
                      <div className="mt-5 flex gap-2">
                        <Link
                          to="/shop"
                          className="flex-1 bg-[#5B3A8E] hover:bg-[#482B75] text-white py-3 rounded-xl text-sm font-bold text-center transition"
                        >
                          View Shop
                        </Link>

                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={removingId === item.id}
                          title="Remove from wishlist"
                          className="w-12 shrink-0 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl flex items-center justify-center transition disabled:opacity-50"
                        >
                          {removingId === item.id ? (
                            <span className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {/* FOOTER NOTE */}
        <div className="mt-10 border-t border-[#E8E3ED] pt-6 text-center">
          <p className="text-sm text-[#9A94A2]">
            LapMob — Your Technology, Our Priority.
          </p>
        </div>

      </div>
    </main>
  )
}
