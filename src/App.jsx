import Cart from './pages/Cart'
import Wishlist from './pages/Wishlist'
import Checkout from './pages/Checkout'
import Shop from "./pages/Shop.jsx"
import AdminDashboard from './pages/AdminDashboard'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { testSupabaseConnection } from './lib/supabase'
import Signup from './pages/Signup'
import Login from './pages/Login'

import {
  Search,
  ShoppingBag,
  Menu,
  ArrowRight,
  Truck,
  ShieldCheck,
  Headphones,
  Zap,
  Heart,
  CheckCircle,
  AlertCircle,
  Database
} from 'lucide-react'

const products = [
  {
    id: 1,
    name: 'Wireless Headphones',
    category: 'Audio Accessories',
    price: 4500,
    oldPrice: 5500,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'
  },
  {
    id: 2,
    name: 'Premium Smart Watch',
    category: 'Smart Gadgets',
    price: 6500,
    oldPrice: 7500,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'
  },
  {
    id: 3,
    name: 'Wireless Keyboard',
    category: 'Laptop Accessories',
    price: 3500,
    oldPrice: 4200,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600'
  },
  {
    id: 4,
    name: 'Premium Mouse',
    category: 'Computer Accessories',
    price: 2200,
    oldPrice: 2800,
    image: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=600'
  }
]

const categories = [
  'Mobile Accessories',
  'Laptop Accessories',
  'Headphones',
  'Smart Gadgets'
]

// Homepage
function HomePage() {
  const [connection, setConnection] = useState('checking')

  useEffect(() => {
    async function checkConnection() {
      try {
        const result = await testSupabaseConnection()
        console.log('Supabase result:', result)
        setConnection(result.connected ? 'connected' : 'error')
      } catch (error) {
        console.error('Supabase connection error:', error)
        setConnection('error')
      }
    }

    checkConnection()
  }, [])

  return (
    <div className="min-h-screen bg-[#09090b] text-white">

      {/* Supabase Status */}
      <div className="flex justify-center items-center gap-2 bg-zinc-900 px-4 py-3 text-sm">
        {connection === 'checking' && (
          <>
            <Database size={17} />
            Checking database connection...
          </>
        )}

        {connection === 'connected' && (
          <>
            <CheckCircle size={17} className="text-green-400" />
            Supabase Connected Successfully
          </>
        )}

        {connection === 'error' && (
          <>
            <AlertCircle size={17} className="text-red-400" />
            Supabase Connection Failed
          </>
        )}
      </div>

      {/* Top Bar */}
      <div className="bg-blue-600 text-center py-2 text-sm">
        Free delivery on orders above Rs. 5,000
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-[#09090b]">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">

          <Link to="/" className="text-2xl font-bold">
            Waseem<span className="text-blue-500">Tech.</span>
          </Link>

          <div className="hidden md:flex gap-8 text-sm text-zinc-300">
            <a href="#home" className="hover:text-blue-400">Home</a>
            <a href="#categories" className="hover:text-blue-400">Categories</a>
            <a href="#products" className="hover:text-blue-400">Products</a>
            <a href="#footer" className="hover:text-blue-400">Contact</a>
          </div>

          <div className="flex gap-4 items-center">
            <button aria-label="Search">
              <Search size={21} />
            </button>

            <button aria-label="Shopping bag">
              <ShoppingBag size={21} />
            </button>

            <Link
              to="/login"
              className="hidden sm:block text-sm text-zinc-300 hover:text-blue-400"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-700"
            >
              Sign Up
            </Link>

            <button className="md:hidden" aria-label="Menu">
              <Menu size={22} />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section id="home" className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">

        <div>
          <p className="text-blue-400 uppercase tracking-[3px] font-semibold text-sm">
            Technology made simple
          </p>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight mt-5">
            Upgrade Your
            <span className="block text-blue-500">Tech Lifestyle.</span>
          </h1>

          <p className="text-zinc-400 leading-7 mt-6 max-w-lg">
            Discover premium mobile and laptop accessories
            designed to improve your everyday technology experience.
          </p>

          <a
            href="#products"
            className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 px-7 py-4 rounded-lg mt-8 font-semibold"
          >
            Explore Products <ArrowRight size={19} />
          </a>
        </div>

        <img
          src="https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1000"
          alt="Technology accessories"
          className="w-full h-[350px] md:h-[450px] object-cover rounded-2xl border border-zinc-800"
        />
      </section>

      {/* Benefits */}
      <section className="border-y border-zinc-800 bg-zinc-900/60">
        <div className="max-w-7xl mx-auto px-6 py-10 grid sm:grid-cols-2 md:grid-cols-4 gap-8">

          {[
            { icon: Truck, title: 'Fast Delivery', desc: 'Reliable order delivery' },
            { icon: ShieldCheck, title: 'Secure Shopping', desc: 'Safe shopping experience' },
            { icon: Headphones, title: 'Customer Support', desc: 'Help when you need it' },
            { icon: Zap, title: 'Quality Products', desc: 'Carefully selected gadgets' }
          ].map((item) => {
            const Icon = item.icon

            return (
              <div key={item.title} className="flex items-center gap-4">
                <div className="p-3 bg-blue-600/10 text-blue-400 rounded-lg">
                  <Icon size={25} />
                </div>

                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{item.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="max-w-7xl mx-auto px-6 py-20">

        <p className="text-blue-400 text-sm uppercase tracking-widest font-semibold">
          Browse Collection
        </p>

        <h2 className="text-3xl font-bold mt-3 mb-10">
          Shop By Category
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((category, index) => (
            <a
              href="#products"
              key={category}
              className="p-7 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-blue-500 transition"
            >
              <span className="text-3xl text-blue-500 font-bold">
                0{index + 1}
              </span>

              <h3 className="mt-5 font-semibold">{category}</h3>

              <p className="text-zinc-500 text-sm mt-2">
                Explore collection
              </p>
            </a>
          ))}
        </div>
      </section>

      {/* Products */}
      <section id="products" className="bg-zinc-900/50 py-20">

        <div className="max-w-7xl mx-auto px-6">

          <p className="text-blue-400 text-sm uppercase tracking-widest font-semibold">
            Featured Collection
          </p>

          <h2 className="text-3xl font-bold mt-3 mb-10">
            Popular Products
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-7">

            {products.map((product) => (
              <div
                key={product.id}
                className="bg-[#111114] border border-zinc-800 rounded-xl overflow-hidden"
              >
                <div className="relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-56 w-full object-cover"
                  />

                  <button
                    aria-label="Add to wishlist"
                    className="absolute right-4 top-4 p-2 bg-black/70 rounded-full"
                  >
                    <Heart size={19} />
                  </button>
                </div>

                <div className="p-5">
                  <p className="text-xs text-blue-400">{product.category}</p>

                  <h3 className="font-semibold mt-2">{product.name}</h3>

                  <div className="flex gap-3 items-center mt-4">
                    <span className="font-bold text-lg">
                      Rs. {product.price.toLocaleString()}
                    </span>

                    <span className="text-zinc-500 line-through text-sm">
                      Rs. {product.oldPrice.toLocaleString()}
                    </span>
                  </div>

                  <button className="w-full mt-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold">
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="border-t border-zinc-800 py-12 px-6">

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6">

          <div>
            <h2 className="text-2xl font-bold">
              Waseem<span className="text-blue-500">Tech.</span>
            </h2>

            <p className="text-zinc-500 text-sm mt-3">
              Your destination for quality tech accessories.
            </p>
          </div>

          <p className="text-zinc-500 text-sm">
            © 2026 WaseemTech Accessories. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

// Main App with routing
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
<Route path="/admin" element={<AdminDashboard />} />
<Route path="/shop" element={<Shop />} />
<Route path="/cart" element={<Cart />} />
<Route path="/checkout" element={<Checkout />} />
<Route path="/wishlist" element={<Wishlist />} />

        <Route
          path="*"
          element={

            <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-4">
              <h1 className="text-5xl font-bold">404</h1>
              <p className="text-zinc-400">Page not found</p>
              <Link to="/" className="text-blue-400 hover:underline">
                Back to Home
              </Link>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
