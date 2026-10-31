
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export default function Cart() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  async function loadCart() {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      navigate('/login')
      return
    }

    const { data, error } = await supabase
      .from('cart_items')
      .select('id, quantity, products(id, name, price, stock, image_url)')
      .eq('user_id', user.id)

    if (error) toast.error(error.message)
    else setItems(data || [])

    setLoading(false)
  }

  useEffect(() => {
    loadCart()
  }, [])

  async function changeQuantity(item, quantity) {
    if (quantity < 1) return removeItem(item.id)
    if (quantity > item.products.stock) {
      toast.error('Available stock limit reached')
      return
    }

    const { error } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', item.id)

    if (error) toast.error(error.message)
    else loadCart()
  }

  async function removeItem(id) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', id)

    if (error) toast.error(error.message)
    else {
      toast.success('Item removed')
      loadCart()
    }
  }

  const total = items.reduce(
    (sum, item) => sum + Number(item.products?.price || 0) * item.quantity,
    0
  )

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-5 py-10">
      <div className="max-w-5xl mx-auto">
        <Link to="/shop" className="text-blue-400 flex gap-2 items-center mb-8">
          <ArrowLeft size={18} /> Continue Shopping
        </Link>

        <h1 className="text-3xl font-bold mb-8">Your Shopping Cart</h1>

        {loading ? <p>Loading cart...</p> : items.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900 rounded-2xl">
            <ShoppingBag size={45} className="mx-auto text-zinc-500 mb-4" />
            <h2 className="text-xl font-semibold">Your cart is empty</h2>
            <Link to="/shop" className="inline-block mt-5 bg-blue-600 px-6 py-3 rounded-lg">
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            <section className="space-y-4">
              {items.map(item => (
                <article key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex gap-4 items-center">
                  <img
                    src={item.products?.image_url || ''}
                    alt={item.products?.name || 'Product'}
                    className="w-20 h-20 object-cover rounded-lg bg-zinc-800"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{item.products?.name || 'Unavailable product'}</h3>
                    <p className="text-blue-400 mt-1">Rs. {Number(item.products?.price || 0).toLocaleString('en-PK')}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={() => changeQuantity(item, item.quantity - 1)} className="bg-zinc-800 rounded px-3 py-1">−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => changeQuantity(item, item.quantity + 1)} className="bg-zinc-800 rounded px-3 py-1">+</button>
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-red-400 p-2" aria-label="Remove item">
                    <Trash2 size={19} />
                  </button>
                </article>
              ))}
            </section>

            <aside className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-fit">
              <h2 className="font-bold text-xl mb-5">Order Summary</h2>
              <div className="flex justify-between text-zinc-400 mb-3">
                <span>Subtotal</span><span>Rs. {total.toLocaleString('en-PK')}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-700 pt-4 font-bold text-lg">
                <span>Total</span><span className="text-blue-400">Rs. {total.toLocaleString('en-PK')}</span>
              </div>
              <button onClick={() => navigate('/checkout')} className="w-full bg-blue-600 hover:bg-blue-500 rounded-lg py-3 mt-6 font-semibold">
                Proceed to Checkout
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}
