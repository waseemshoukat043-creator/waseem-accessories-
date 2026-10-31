
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export default function Wishlist() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  async function loadWishlist() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      navigate('/login')
      return
    }

    const { data, error } = await supabase
      .from('wishlist')
      .select('id, products(id, name, price, image_url, stock)')
      .eq('user_id', user.id)

    if (error) toast.error(error.message)
    else setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadWishlist()
  }, [])

  async function removeItem(id) {
    const { error } = await supabase.from('wishlist').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Removed from wishlist')
      loadWishlist()
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-5 py-10">
      <div className="max-w-6xl mx-auto">
        <Link to="/shop" className="text-blue-400">← Continue Shopping</Link>
        <h1 className="text-3xl font-bold mt-7 mb-8 flex gap-3 items-center">
          <Heart className="text-red-400" /> My Wishlist
        </h1>

        {loading ? <p>Loading...</p> : items.length === 0 ? (
          <p className="text-zinc-400 py-16">Your wishlist is empty.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {items.map(item => (
              <article key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <img
                  src={item.products?.image_url || ''}
                  alt={item.products?.name || 'Product'}
                  className="w-full aspect-square object-cover bg-zinc-800"
                />
                <div className="p-4">
                  <h2 className="font-semibold">{item.products?.name}</h2>
                  <p className="text-blue-400 mt-2">
                    Rs. {Number(item.products?.price || 0).toLocaleString('en-PK')}
                  </p>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="mt-4 text-red-400 flex gap-2 items-center text-sm"
                  >
                    <Trash2 size={16} /> Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
