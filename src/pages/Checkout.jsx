
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  ShoppingBag,
  MapPin,
  CreditCard,
  Package,
  Truck
} from 'lucide-react'
import { supabase } from '../lib/supabase'

const PRIMARY = '#5B3A8E'

export default function Checkout() {
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successOrder, setSuccessOrder] = useState(null)

  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [transactionId, setTransactionId] = useState('')
  const [proof, setProof] = useState(null)

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    shipping_address: '',
    shipping_city: '',
    notes: ''
  })

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          navigate('/login')
          return
        }

        setUser(user)

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, phone, address, city')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) throw profileError

        setForm(current => ({
          ...current,
          customer_name:
            profile?.full_name || user.user_metadata?.full_name || '',
          customer_phone: profile?.phone || '',
          shipping_address: profile?.address || '',
          shipping_city: profile?.city || ''
        }))

        const { data, error } = await supabase
          .from('cart_items')
          .select(`
            id,
            quantity,
            products (
              id,
              name,
              price,
              stock,
              image_url
            )
          `)
          .eq('user_id', user.id)

        if (error) throw error

        setItems(data || [])
      } catch (error) {
        toast.error(error.message || 'Could not load checkout')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [navigate])

  const subtotal = items.reduce(
    (sum, item) =>
      sum + Number(item.products?.price || 0) * Number(item.quantity || 0),
    0
  )

  const unavailableItems = items.filter(item => {
    const product = item.products
    return (
      !product ||
      Number(product.stock || 0) < Number(item.quantity || 0)
    )
  })

  function updateForm(field, value) {
    setForm(current => ({
      ...current,
      [field]: value
    }))
  }

  async function placeOrder(event) {
    event.preventDefault()

    if (!items.length) {
      toast.error('Your cart is empty')
      return
    }

    if (unavailableItems.length) {
      toast.error('Some products have insufficient stock. Please update your cart.')
      return
    }

    if (
      !form.customer_name.trim() ||
      !form.customer_phone.trim() ||
      !form.shipping_address.trim() ||
      !form.shipping_city.trim()
    ) {
      toast.error('Please complete all shipping details')
      return
    }

    if (paymentMethod !== 'cod' && (!transactionId.trim() || !proof)) {
      toast.error('Enter transaction ID and upload payment screenshot')
      return
    }

    if (
      proof &&
      !['image/jpeg', 'image/png', 'image/webp'].includes(proof.type)
    ) {
      toast.error('Only JPG, PNG or WEBP images are allowed')
      return
    }

    if (proof && proof.size > 5 * 1024 * 1024) {
      toast.error('Payment screenshot must be under 5 MB')
      return
    }

    setSubmitting(true)

    try {
      const { data: order, error } = await supabase.rpc(
        'create_customer_order',
        {
          p_customer_name: form.customer_name.trim(),
          p_customer_phone: form.customer_phone.trim(),
          p_shipping_address: form.shipping_address.trim(),
          p_shipping_city: form.shipping_city.trim(),
          p_payment_method: paymentMethod,
          p_notes: form.notes.trim() || null
        }
      )

      if (error) throw error

      if (!order?.order_id || !order?.order_number) {
        throw new Error(
          'Order response was incomplete. Please contact the store.'
        )
      }

      if (paymentMethod !== 'cod') {
        const safeName = proof.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${user.id}/${order.order_id}/${Date.now()}-${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(path, proof, { upsert: false })

        if (uploadError) {
          throw new Error(
            `Order was created, but payment screenshot upload failed: ${uploadError.message}. Contact the store with order ${order.order_number}.`
          )
        }

        const { error: proofError } = await supabase.rpc(
          'submit_payment_proof',
          {
            p_order_id: order.order_id,
            p_transaction_id: transactionId.trim(),
            p_proof_path: path
          }
        )

        if (proofError) {
          throw new Error(
            `Order was created, but payment proof submission failed: ${proofError.message}. Contact the store with order ${order.order_number}.`
          )
        }
      }

      setSuccessOrder({
        order_number: order.order_number,
        order_id: order.order_id,
        total_amount: Number(order.total_amount),
        payment_method: paymentMethod,
        customer_name: form.customer_name,
        shipping_city: form.shipping_city
      })

      setItems([])
      toast.success('Your order has been placed successfully!')
    } catch (error) {
      toast.error(error.message || 'Could not place order')
    } finally {
      setSubmitting(false)
    }
  }

  const cardClass =
    'bg-white border border-[#E8E3ED] rounded-2xl p-6 shadow-sm'

  const inputClass =
    'w-full bg-white text-[#24212B] placeholder:text-[#9A94A2] border border-[#DED7E7] rounded-xl px-4 py-3 outline-none transition focus:border-[#5B3A8E] focus:ring-2 focus:ring-[#5B3A8E]/15'

  const primaryButton =
    'bg-[#5B3A8E] hover:bg-[#482B75] text-white rounded-xl font-bold transition disabled:opacity-60 disabled:cursor-not-allowed'

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F9F6] grid place-items-center">
        <div className="text-center">
          <div className="w-11 h-11 border-4 border-[#5B3A8E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#716B7B] font-medium">
            Loading checkout...
          </p>
        </div>
      </main>
    )
  }

  // SUCCESS SCREEN
  if (successOrder) {
    return (
      <main className="min-h-screen bg-[#F8F9F6] px-5 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-[#E8E3ED] rounded-2xl shadow-lg overflow-hidden">

            <div className="bg-[#5B3A8E] text-white px-6 py-10 text-center">
              <div className="w-20 h-20 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={48} className="text-white" />
              </div>

              <h1 className="text-3xl font-extrabold mb-2 text-white">
                Order Placed Successfully!
              </h1>

              <p className="text-white/85">
                Thank you, {successOrder.customer_name}. Your order has been received.
              </p>
            </div>

            <div className="p-7 space-y-6">
              <div className="text-center">
                <p className="text-sm text-[#716B7B] mb-2">
                  Your Order Number
                </p>

                <p className="text-2xl font-extrabold text-[#5B3A8E]">
                  {successOrder.order_number}
                </p>

                <p className="text-xs text-[#9A94A2] mt-2">
                  Please save this number for future reference.
                </p>
              </div>

              <div className="border-t border-b border-[#E8E3ED] py-5 space-y-4">
                <div className="flex justify-between gap-3">
                  <span className="text-[#716B7B] flex items-center gap-2">
                    <CreditCard size={17} />
                    Payment Method
                  </span>
                  <strong className="text-[#24212B]">
                    {successOrder.payment_method === 'cod'
                      ? 'Cash on Delivery'
                      : successOrder.payment_method.replace('_', ' ').toUpperCase()}
                  </strong>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-[#716B7B] flex items-center gap-2">
                    <MapPin size={17} />
                    Delivery City
                  </span>
                  <strong className="text-[#24212B]">
                    {successOrder.shipping_city}
                  </strong>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-[#716B7B] flex items-center gap-2">
                    <Package size={17} />
                    Order Status
                  </span>
                  <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold">
                    Pending
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-[#716B7B]">Total Amount</span>
                  <strong className="text-xl text-[#5B3A8E]">
                    Rs. {successOrder.total_amount.toLocaleString('en-PK')}
                  </strong>
                </div>
              </div>

              <div className="bg-[#EDE5F7] border border-[#DED2EF] rounded-xl p-4 flex gap-3">
                <Truck className="text-[#5B3A8E] shrink-0" size={22} />
                <div>
                  <h3 className="font-bold text-[#24212B] text-sm">
                    What's Next?
                  </h3>
                  <p className="text-sm text-[#716B7B] mt-1">
                    Our store will review your order and update its status.
                    For Cash on Delivery, pay when your parcel arrives.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/shop"
                  className={`flex-1 ${primaryButton} text-center py-3`}
                >
                  Continue Shopping
                </Link>

                <Link
                  to="/"
                  className="flex-1 bg-[#24212B] hover:bg-[#393440] text-white text-center py-3 rounded-xl font-bold transition"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>

          <p className="text-center text-[#9A94A2] text-sm mt-6">
            Thank you for shopping with LapMob.
          </p>
        </div>
      </main>
    )
  }

  // EMPTY CART
  if (!items.length) {
    return (
      <main className="min-h-screen bg-[#F8F9F6] flex items-center justify-center px-5">
        <div className="bg-white rounded-2xl border border-[#E8E3ED] shadow-sm p-10 text-center max-w-md w-full">
          <ShoppingBag size={45} className="mx-auto text-[#5B3A8E] mb-4" />

          <h1 className="text-2xl font-bold text-[#24212B]">
            Your Cart is Empty
          </h1>

          <p className="text-[#716B7B] mt-2 mb-6">
            Add some products before proceeding to checkout.
          </p>

          <Link
            to="/shop"
            className={`inline-block ${primaryButton} px-6 py-3`}
          >
            Explore Products
          </Link>
        </div>
      </main>
    )
  }

  // CHECKOUT PAGE
  return (
    <main className="min-h-screen bg-[#F8F9F6] text-[#24212B] px-5 py-10">
      <div className="max-w-6xl mx-auto">

        <Link
          to="/cart"
          className="text-[#5B3A8E] hover:text-[#482B75] flex items-center gap-2 mb-7 font-semibold text-sm"
        >
          <ArrowLeft size={18} />
          Back to Cart
        </Link>

        <div className="mb-8">
          <p className="text-[#5B3A8E] font-bold text-xs uppercase tracking-widest mb-2">
            LAPMOB
          </p>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#24212B]">
            Secure Checkout
          </h1>

          <p className="text-[#716B7B] mt-2">
            Complete your shipping and payment details.
          </p>
        </div>

        <form
          onSubmit={placeOrder}
          className="grid lg:grid-cols-[1fr_360px] gap-7 items-start"
        >
          <div className="space-y-6">

            {/* SHIPPING */}
            <section className={cardClass}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-[#EDE5F7] text-[#5B3A8E] grid place-items-center">
                  <MapPin size={22} />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-[#24212B]">
                    Shipping Information
                  </h2>
                  <p className="text-sm text-[#716B7B]">
                    Where should we deliver your order?
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-[#24212B] mb-2">
                    Full Name *
                  </label>
                  <input
                    required
                    className={inputClass}
                    value={form.customer_name}
                    onChange={e => updateForm('customer_name', e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#24212B] mb-2">
                    Phone Number *
                  </label>
                  <input
                    required
                    type="tel"
                    className={inputClass}
                    value={form.customer_phone}
                    onChange={e => updateForm('customer_phone', e.target.value)}
                    placeholder="03XXXXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#24212B] mb-2">
                    City *
                  </label>
                  <input
                    required
                    className={inputClass}
                    value={form.shipping_city}
                    onChange={e => updateForm('shipping_city', e.target.value)}
                    placeholder="Your city"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-[#24212B] mb-2">
                    Complete Shipping Address *
                  </label>
                  <textarea
                    required
                    className={inputClass}
                    value={form.shipping_address}
                    onChange={e => updateForm('shipping_address', e.target.value)}
                    placeholder="House number, street, area and nearest landmark"
                    rows={3}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-[#24212B] mb-2">
                    Order Notes (Optional)
                  </label>
                  <textarea
                    className={inputClass}
                    value={form.notes}
                    onChange={e => updateForm('notes', e.target.value)}
                    placeholder="Any special delivery instructions?"
                    rows={2}
                  />
                </div>
              </div>
            </section>

            {/* PAYMENT */}
            <section className={cardClass}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-[#EDE5F7] text-[#5B3A8E] grid place-items-center">
                  <CreditCard size={22} />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-[#24212B]">
                    Payment Method
                  </h2>
                  <p className="text-sm text-[#716B7B]">
                    Select how you want to pay.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ['cod', 'Cash on Delivery', 'Pay when your parcel arrives'],
                  ['jazzcash', 'JazzCash', 'Mobile wallet payment'],
                  ['easypaisa', 'Easypaisa', 'Mobile wallet payment'],
                  ['bank_transfer', 'Bank Transfer', 'Direct bank payment']
                ].map(([value, label, description]) => (
                  <label
                    key={value}
                    className={`flex items-start gap-3 border rounded-xl p-4 cursor-pointer transition ${
                      paymentMethod === value
                        ? 'border-[#5B3A8E] bg-[#EDE5F7]'
                        : 'border-[#E8E3ED] hover:border-[#B7D7A8]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={value}
                      checked={paymentMethod === value}
                      onChange={() => setPaymentMethod(value)}
                      className="w-4 h-4 mt-1 accent-[#5B3A8E]"
                    />

                    <div>
                      <p className="font-bold text-sm text-[#24212B]">
                        {label}
                      </p>
                      <p className="text-xs text-[#716B7B] mt-1">
                        {description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {paymentMethod !== 'cod' && (
                <div className="mt-5 bg-[#F5F0FA] border border-[#DED2EF] rounded-xl p-4 space-y-4">
                  <p className="text-[#482B75] text-sm">
                    Make sure you have transferred the exact amount to the store's verified account before submitting payment proof.
                  </p>

                  <div>
                    <label className="block text-sm font-semibold text-[#24212B] mb-2">
                      Transaction ID *
                    </label>

                    <input
                      required
                      className={inputClass}
                      value={transactionId}
                      onChange={e => setTransactionId(e.target.value)}
                      placeholder="Enter transaction ID"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#24212B] mb-2">
                      Payment Screenshot *
                    </label>

                    <input
                      required
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={e => setProof(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-[#24212B] file:mr-3 file:rounded-lg file:border-0 file:bg-[#5B3A8E] file:px-4 file:py-2 file:text-white file:font-semibold"
                    />

                    <p className="text-xs text-[#716B7B] mt-2">
                      JPG, PNG or WEBP. Maximum size 5 MB.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ORDER SUMMARY */}
          <aside className={`${cardClass} lg:sticky lg:top-6`}>
            <h2 className="text-xl font-bold text-[#24212B] mb-5">
              Order Summary
            </h2>

            <div className="space-y-4">
              {items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-[#F0EDF3] pb-4"
                >
                  <div className="w-14 h-14 bg-[#F5F3F7] rounded-lg overflow-hidden shrink-0">
                    {item.products?.image_url ? (
                      <img
                        src={item.products.image_url}
                        alt={item.products.name || 'Product'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[#9A94A2]">
                        <Package size={22} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#24212B] line-clamp-2">
                      {item.products?.name || 'Product'}
                    </p>

                    <p className="text-xs text-[#716B7B] mt-1">
                      Quantity: {item.quantity}
                    </p>
                  </div>

                  <p className="font-bold text-sm text-[#24212B] whitespace-nowrap">
                    Rs. {(Number(item.products?.price || 0) * item.quantity).toLocaleString('en-PK')}
                  </p>
                </div>
              ))}
            </div>

            {unavailableItems.length > 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-700 font-medium">
                  Some products have insufficient stock. Please return to your cart and update quantities.
                </p>
                <Link to="/cart" className="text-sm text-red-800 underline font-bold mt-2 inline-block">
                  Update Cart
                </Link>
              </div>
            )}

            <div className="space-y-3 border-t border-[#E8E3ED] pt-5 mt-5">
              <div className="flex justify-between text-sm text-[#716B7B]">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toLocaleString('en-PK')}</span>
              </div>

              <div className="flex justify-between text-sm text-[#716B7B]">
                <span>Delivery Fee</span>
                <span className="text-green-600 font-semibold">Free</span>
              </div>

              <div className="flex justify-between items-center border-t border-[#E8E3ED] pt-4">
                <span className="font-bold text-lg text-[#24212B]">
                  Total
                </span>

                <span className="text-2xl font-extrabold text-[#5B3A8E]">
                  Rs. {subtotal.toLocaleString('en-PK')}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !items.length || unavailableItems.length > 0}
              className={`w-full ${primaryButton} py-4 mt-6 flex items-center justify-center gap-2`}
            >
              {submitting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing Order...
                </>
              ) : (
                <>
                  <ShoppingBag size={19} />
                  Place Order
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-[#716B7B] mt-4">
              <ShieldCheck size={17} className="text-green-600" />
              Secure Order Processing
            </div>

            <p className="text-xs text-center text-[#9A94A2] mt-3">
              Your order details are securely processed.
            </p>
          </aside>
        </form>
      </div>
    </main>
  )
}
