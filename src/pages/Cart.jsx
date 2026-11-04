
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Trash2,
  ShoppingBag,
  Plus,
  Minus,
  Package,
  ShieldCheck,
  RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

const formatPrice = (price) =>
  Number(price || 0).toLocaleString('en-PK')

export default function Cart() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [removingId, setRemovingId] = useState(null)

  const navigate = useNavigate()

  useEffect(() => {
    loadCart()
  }, [])

  async function loadCart() {
    try {
      setLoading(true)

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError) throw userError

      if (!user) {
        navigate('/login')
        return
      }

      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          quantity,
          product_id,
          products (
            id,
            name,
            price,
            stock,
            image_url,
            description,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setItems(data || [])
    } catch (error) {
      console.error('Cart loading error:', error)
      toast.error(error.message || 'Unable to load cart')
    } finally {
      setLoading(false)
    }
  }

  async function changeQuantity(item, quantity) {
    if (quantity < 1) {
      await removeItem(item.id)
      return
    }

    const stock = Number(item.products?.stock || 0)

    if (quantity > stock) {
      toast.error('Available stock limit reached')
      return
    }

    try {
      setUpdatingId(item.id)

      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', item.id)

      if (error) throw error

      setItems(prev =>
        prev.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity }
            : cartItem
        )
      )
    } catch (error) {
      toast.error(error.message || 'Unable to update quantity')
    } finally {
      setUpdatingId(null)
    }
  }

  async function removeItem(id) {
    try {
      setRemovingId(id)

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', id)

      if (error) throw error

      setItems(prev => prev.filter(item => item.id !== id))
      toast.success('Item removed from cart')
    } catch (error) {
      toast.error(error.message || 'Unable to remove item')
    } finally {
      setRemovingId(null)
    }
  }

  const subtotal = items.reduce(
    (sum, item) =>
      sum + Number(item.products?.price || 0) * Number(item.quantity || 0),
    0
  )

  const totalItems = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  )

  const unavailableItems = items.filter(
    item =>
      !item.products ||
      item.products.is_active === false ||
      Number(item.products.stock || 0) < Number(item.quantity || 0)
  )

  const canCheckout = items.length > 0 && unavailableItems.length === 0

  return (
    <main className="min-h-screen bg-[#f8f9f6] px-4 py-8 text-[#24212b] sm:px-6 lg:py-12">

      <div className="mx-auto max-w-6xl">

        {/* Top navigation */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 rounded-xl border border-[#e8e3ed] bg-white px-4 py-2.5 text-sm font-semibold text-[#5b3a8e] transition hover:border-[#5b3a8e] hover:bg-[#ede5f7]"
          >
            <ArrowLeft size={17} />
            Continue Shopping
          </Link>

          <button
            type="button"
            onClick={loadCart}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e8e3ed] bg-white px-4 py-2.5 text-sm font-semibold text-[#514b5a] hover:border-[#5b3a8e] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh Cart
          </button>
        </div>

        {/* Heading */}
        <div className="mb-9">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[3px] text-[#5b3a8e]">
            LapMob Shopping
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight text-[#24212b] sm:text-4xl">
            Your Shopping Cart
          </h1>

          <p className="mt-2 text-sm text-[#716b7b]">
            Review your selected products before checkout.
          </p>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="rounded-2xl border border-[#e8e3ed] bg-white py-20 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#ede5f7] border-t-[#5b3a8e]" />
            <p className="mt-4 font-semibold text-[#514b5a]">
              Loading your cart...
            </p>
          </div>
        ) : items.length === 0 ? (

          /* Empty cart */
          <div className="rounded-2xl border border-[#e8e3ed] bg-white px-5 py-20 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#ede5f7]">
              <ShoppingBag size={38} className="text-[#5b3a8e]" />
            </div>

            <h2 className="mt-6 text-2xl font-extrabold text-[#24212b]">
              Your Cart is Empty
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-[#716b7b]">
              You haven't added any products yet. Explore our collection
              and find something you love.
            </p>

            <Link
              to="/shop"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5b3a8e] px-7 py-3.5 font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#482b75]"
            >
              <ShoppingBag size={18} />
              Explore Products
            </Link>
          </div>

        ) : (

          <>
            {/* Cart summary strip */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e8e3ed] bg-white p-5 shadow-sm">
              <div>
                <p className="font-bold text-[#24212b]">
                  Shopping Cart Items
                </p>
                <p className="mt-1 text-sm text-[#716b7b]">
                  {items.length} different products · {totalItems} total units
                </p>
              </div>

              <div className="rounded-xl bg-[#ede5f7] px-4 py-2 text-sm font-bold text-[#5b3a8e]">
                {totalItems} Items
              </div>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[1fr_350px]">

              {/* Cart products */}
              <section className="space-y-4">

                {items.map(item => {
                  const product = item.products
                  const unavailable =
                    !product ||
                    product.is_active === false ||
                    Number(product.stock || 0) < Number(item.quantity || 0)

                  return (
                    <article
                      key={item.id}
                      className="flex flex-col gap-4 rounded-2xl border border-[#e8e3ed] bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:p-5"
                    >
                      {/* Product image */}
                      <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f3f0f7] sm:w-28">
                        {product?.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name || 'Product'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package size={38} className="text-[#a29baa]" />
                        )}
                      </div>

                      {/* Product information */}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-bold text-[#24212b]">
                          {product?.name || 'Unavailable Product'}
                        </h3>

                        <p className="mt-1 text-sm text-[#716b7b]">
                          {product?.description || 'Quality tech accessory.'}
                        </p>

                        <p className="mt-3 text-lg font-extrabold text-[#5b3a8e]">
                          Rs. {formatPrice(product?.price)}
                        </p>

                        {unavailable && (
                          <p className="mt-2 text-xs font-bold text-[#c33f55]">
                            This item is unavailable or has insufficient stock.
                          </p>
                        )}

                        {/* Quantity controls */}
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span className="text-sm font-semibold text-[#514b5a]">
                            Quantity:
                          </span>

                          <div className="flex items-center overflow-hidden rounded-lg border border-[#e8e3ed]">
                            <button
                              type="button"
                              disabled={
                                updatingId === item.id ||
                                removingId === item.id
                              }
                              onClick={() =>
                                changeQuantity(item, Number(item.quantity) - 1)
                              }
                              aria-label="Decrease quantity"
                              className="flex h-9 w-9 items-center justify-center bg-[#f3f0f7] text-[#5b3a8e] hover:bg-[#ede5f7] disabled:opacity-50"
                            >
                              <Minus size={15} />
                            </button>

                            <span className="min-w-10 text-center text-sm font-bold text-[#24212b]">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              disabled={
                                updatingId === item.id ||
                                removingId === item.id ||
                                Number(item.quantity) >= Number(product?.stock || 0)
                              }
                              onClick={() =>
                                changeQuantity(item, Number(item.quantity) + 1)
                              }
                              aria-label="Increase quantity"
                              className="flex h-9 w-9 items-center justify-center bg-[#f3f0f7] text-[#5b3a8e] hover:bg-[#ede5f7] disabled:opacity-40"
                            >
                              <Plus size={15} />
                            </button>
                          </div>

                          {updatingId === item.id && (
                            <span className="text-xs text-[#716b7b]">
                              Updating...
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price and remove */}
                      <div className="flex items-center justify-between gap-4 border-t border-[#eee9f2] pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                        <div className="text-right">
                          <p className="text-xs font-semibold text-[#716b7b]">
                            Item Total
                          </p>
                          <p className="mt-1 text-lg font-extrabold text-[#24212b]">
                            Rs. {formatPrice(
                              Number(product?.price || 0) *
                              Number(item.quantity || 0)
                            )}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={removingId === item.id}
                          onClick={() => removeItem(item.id)}
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#c33f55] transition hover:bg-[#fff0f1] disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                          {removingId === item.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </article>
                  )
                })}

              </section>

              {/* Order summary */}
              <aside className="rounded-2xl border border-[#e8e3ed] bg-white p-6 shadow-sm lg:sticky lg:top-24">
                <h2 className="text-xl font-extrabold text-[#24212b]">
                  Order Summary
                </h2>

                <p className="mt-1 text-sm text-[#716b7b]">
                  Review your order total.
                </p>

                <div className="my-6 space-y-4">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[#716b7b]">Total Items</span>
                    <span className="font-semibold text-[#24212b]">
                      {totalItems}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[#716b7b]">Subtotal</span>
                    <span className="font-semibold text-[#24212b]">
                      Rs. {formatPrice(subtotal)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[#716b7b]">Shipping</span>
                    <span className="font-semibold text-[#24834b]">
                      Calculated at checkout
                    </span>
                  </div>

                  <div className="border-t border-[#e8e3ed] pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-base font-bold text-[#24212b]">
                        Estimated Total
                      </span>

                      <span className="text-xl font-extrabold text-[#5b3a8e]">
                        Rs. {formatPrice(subtotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {unavailableItems.length > 0 && (
                  <div className="mb-4 rounded-xl border border-[#f2c7ce] bg-[#fff0f1] p-3 text-sm text-[#a72e43]">
                    Please remove unavailable items or reduce their quantity
                    before checkout.
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canCheckout}
                  onClick={() => navigate('/checkout')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5b3a8e] py-3.5 font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#482b75] disabled:cursor-not-allowed disabled:bg-[#c8c3cd] disabled:text-white"
                >
                  <ShoppingBag size={18} />
                  Proceed to Checkout
                </button>

                <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-[#716b7b]">
                  <ShieldCheck size={16} className="text-[#24834b]" />
                  Secure shopping experience
                </div>

                <Link
                  to="/shop"
                  className="mt-4 block text-center text-sm font-bold text-[#5b3a8e] hover:text-[#482b75]"
                >
                  Continue Shopping
                </Link>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
