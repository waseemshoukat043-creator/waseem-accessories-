
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const PAYMENT_METHODS = [
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'easypaisa', label: 'Easypaisa' },
  { value: 'bank_transfer', label: 'Bank Transfer' }
]

export default function Checkout() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [cart, setCart] = useState([])
  const [user, setUser] = useState(null)
  const [paymentProof, setPaymentProof] = useState(null)

  const [paymentMethod, setPaymentMethod] = useState('cod')

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    shipping_address: '',
    shipping_city: '',
    notes: ''
  })

  const [successOrder, setSuccessOrder] = useState(null)

  useEffect(() => {
    loadCheckout()
  }, [])

  async function loadCheckout() {
    try {
      const {
        data: { user: currentUser },
        error: authError
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!currentUser) {
        toast.error('Please login before checkout')
        navigate('/login')
        return
      }

      setUser(currentUser)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle()

      setForm(previous => ({
        ...previous,
        customer_name:
          profile?.full_name ||
          currentUser.user_metadata?.full_name ||
          '',
        customer_phone: profile?.phone || ''
      }))

      const { data: cartItems, error: cartError } = await supabase
        .from('cart_items')
        .select('*, products(*)')
        .eq('user_id', currentUser.id)

      if (cartError) throw cartError

      const validItems = (cartItems || []).filter(
        item => item.products
      )

      setCart(validItems)

      if (!validItems.length) {
        toast.error('Your cart is empty')
      }
    } catch (error) {
      console.error('Checkout loading error:', error)
      toast.error(error.message || 'Could not load checkout')
    }
  }

  function handleChange(event) {
    const { name, value } = event.target

    setForm(previous => ({
      ...previous,
      [name]: value
    }))
  }

  const total = cart.reduce((sum, item) => {
    const price = Number(item.products?.price || 0)
    const quantity = Number(item.quantity || 1)

    return sum + price * quantity
  }, 0)

  async function placeOrder(event) {
    event.preventDefault()

    if (!user) {
      toast.error('Please login first')
      return
    }

    if (!cart.length) {
      toast.error('Your cart is empty')
      return
    }

    if (
      paymentMethod !== 'cod' &&
      !paymentProof
    ) {
      toast.error('Please upload your payment proof')
      return
    }

    setLoading(true)

    try {
      // Create order through existing Supabase RPC
      const { data: order, error: orderError } =
        await supabase.rpc('create_customer_order', {
          p_customer_name: form.customer_name.trim(),
          p_customer_phone: form.customer_phone.trim(),
          p_shipping_address: form.shipping_address.trim(),
          p_shipping_city: form.shipping_city.trim(),
          p_payment_method: paymentMethod,
          p_notes: form.notes.trim() || null
        })

      if (orderError) throw orderError

      if (!order?.order_id || !order?.order_number) {
        throw new Error(
          'Order was created but order details were not returned'
        )
      }

      // Upload payment proof for online payments
      if (paymentMethod !== 'cod') {
        const extension =
          paymentProof.name.split('.').pop() || 'jpg'

        const filePath =
          `${user.id}/${order.order_id}-${Date.now()}.${extension}`

        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, paymentProof, {
            upsert: false
          })

        if (uploadError) throw uploadError

        const { error: proofError } = await supabase.rpc(
          'submit_payment_proof',
          {
            p_order_id: order.order_id,
            p_file_path: filePath
          }
        )

        if (proofError) throw proofError
      }

      // Notify LapMob admin through WhatsApp backend
      try {
        const {
          data: sessionData,
          error: sessionError
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        const accessToken =
          sessionData?.session?.access_token

        if (accessToken) {
          const apiBase = (
            import.meta.env.VITE_WHATSAPP_API_URL ||
            'http://localhost:5000'
          ).replace(/\/$/, '')

          const response = await fetch(
            `${apiBase}/api/order-created`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`
              },
              body: JSON.stringify({
                order_id: order.order_id,
                order_number: order.order_number
              })
            }
          )

          const responseText = await response.text()

          if (!response.ok) {
            console.error(
              'LapMob WhatsApp notification error:',
              responseText
            )
          } else {
            console.log(
              'LapMob WhatsApp notification:',
              responseText
            )
          }
        } else {
          console.warn(
            'WhatsApp notification skipped: No active session'
          )
        }
      } catch (notificationError) {
        console.error(
          'LapMob WhatsApp notification failed:',
          notificationError.message
        )
      }

      // Clear cart after successful order
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Cart cleanup error:', deleteError)
      }

      setCart([])
      setSuccessOrder(order)
      toast.success('Your order has been placed successfully!')
    } catch (error) {
      console.error('Order placement error:', error)
      toast.error(error.message || 'Could not place order')
    } finally {
      setLoading(false)
    }
  }

  if (successOrder) {
    return (
      <main className="min-h-screen bg-[#f8f9f6] px-4 py-16">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-5xl">✓</div>

          <h1 className="text-2xl font-bold text-[#24212B]">
            Order placed successfully!
          </h1>

          <p className="mt-3 text-gray-600">
            Thank you for shopping with LapMob.
          </p>

          <p className="mt-5 font-semibold text-[#5B3A8E]">
            Order Number: {successOrder.order_number}
          </p>

          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="mt-8 rounded-xl bg-[#5B3A8E] px-7 py-3 font-semibold text-white hover:bg-[#482b75]"
          >
            Continue Shopping
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f8f9f6] px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold text-[#24212B]">
          Checkout
        </h1>

        <div className="grid gap-8 lg:grid-cols-3">
          <form
            onSubmit={placeOrder}
            className="space-y-6 rounded-2xl bg-white p-6 shadow-sm lg:col-span-2"
          >
            <section>
              <h2 className="mb-5 text-xl font-bold">
                Delivery Information
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  required
                  name="customer_name"
                  value={form.customer_name}
                  onChange={handleChange}
                  placeholder="Full Name"
                  className="w-full rounded-xl border p-3 outline-none focus:border-[#5B3A8E]"
                />

                <input
                  required
                  name="customer_phone"
                  value={form.customer_phone}
                  onChange={handleChange}
                  placeholder="Phone Number"
                  className="w-full rounded-xl border p-3 outline-none focus:border-[#5B3A8E]"
                />

                <input
                  required
                  name="shipping_city"
                  value={form.shipping_city}
                  onChange={handleChange}
                  placeholder="City"
                  className="w-full rounded-xl border p-3 outline-none focus:border-[#5B3A8E]"
                />

                <textarea
                  required
                  name="shipping_address"
                  value={form.shipping_address}
                  onChange={handleChange}
                  placeholder="Complete Delivery Address"
                  rows={3}
                  className="w-full rounded-xl border p-3 outline-none focus:border-[#5B3A8E] sm:col-span-2"
                />
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold">
                Payment Method
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                {PAYMENT_METHODS.map(method => (
                  <label
                    key={method.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${
                      paymentMethod === method.value
                        ? 'border-[#5B3A8E] bg-[#EDE5F7]'
                        : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.value}
                      checked={paymentMethod === method.value}
                      onChange={() => {
                        setPaymentMethod(method.value)
                        setPaymentProof(null)
                      }}
                    />

                    <span className="font-medium">
                      {method.label}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {paymentMethod !== 'cod' && (
              <section>
                <h2 className="mb-3 text-lg font-bold">
                  Upload Payment Screenshot
                </h2>

                <input
                  type="file"
                  accept="image/*,.pdf"
                  required
                  onChange={event =>
                    setPaymentProof(
                      event.target.files?.[0] || null
                    )
                  }
                  className="w-full rounded-xl border p-3"
                />

                <p className="mt-2 text-sm text-gray-500">
                  Upload your transaction receipt.
                </p>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-lg font-bold">
                Additional Notes
              </h2>

              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any special delivery instructions?"
                className="w-full rounded-xl border p-3 outline-none focus:border-[#5B3A8E]"
              />
            </section>

            <button
              type="submit"
              disabled={loading || !cart.length}
              className="w-full rounded-xl bg-[#5B3A8E] px-6 py-4 font-bold text-white hover:bg-[#482b75] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Processing Order...' : 'Place Order'}
            </button>
          </form>

          <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-bold">
              Order Summary
            </h2>

            {cart.map(item => (
              <div
                key={item.id}
                className="flex justify-between gap-3 border-b py-3"
              >
                <div>
                  <p className="font-medium">
                    {item.products?.name}
                  </p>

                  <p className="text-sm text-gray-500">
                    Quantity: {item.quantity || 1}
                  </p>
                </div>

                <p className="font-semibold">
                  PKR {(
                    Number(item.products?.price || 0) *
                    Number(item.quantity || 1)
                  ).toLocaleString()}
                </p>
              </div>
            ))}

            <div className="mt-5 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-[#5B3A8E]">
                PKR {total.toLocaleString()}
              </span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
