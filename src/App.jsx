
import Cart from './pages/Cart'
import Wishlist from './pages/Wishlist'
import Checkout from './pages/Checkout'
import Shop from './pages/Shop.jsx'
import AdminDashboardPro from './pages/AdminDashboardPro'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Signup from './pages/Signup'
import Login from './pages/Login'

import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { testSupabaseConnection } from './lib/supabase'

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

function HomePage() {
  const [connection, setConnection] = useState('checking')
  const [menuOpen, setMenuOpen] = useState(false)

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
    <div className="min-h-screen bg-white text-gray-900">

      {/* Supabase Status */}
      <div className="flex justify-center items-center gap-2 bg-purple-50 border-b border-purple-100 px-4 py-3 text-sm text-gray-700">
        {connection === 'checking' && (
          <>
            <Database size={17} className="text-purple-600" />
            Checking database connection...
          </>
        )}

        {connection === 'connected' && (
          <>
            <CheckCircle size={17} className="text-green-600" />
            Supabase Connected Successfully
          </>
        )}

        {connection === 'error' && (
          <>
            <AlertCircle size={17} className="text-red-600" />
            Supabase Connection Failed
          </>
        )}
      </div>

      {/* Top Bar */}
      <div className="bg-purple-700 text-white text-center py-2 px-4 text-sm font-medium">
        Free delivery on orders above Rs. 5,000
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">

          <Link to="/" className="text-2xl font-extrabold tracking-tight text-gray-900">
            Lap<span className="text-purple-600">Mob.</span>
          </Link>

          <div className="hidden md:flex gap-8 text-sm font-medium text-gray-600">
            <a href="#home" className="hover:text-purple-600 transition">Home</a>
            <a href="#categories" className="hover:text-purple-600 transition">Categories</a>
            <a href="#products" className="hover:text-purple-600 transition">Products</a>
            <a href="#footer" className="hover:text-purple-600 transition">Contact</a>
          </div>

          <div className="flex gap-4 items-center">
            <button
              aria-label="Search"
              className="text-gray-700 hover:text-purple-600"
            >
              <Search size={21} />
            </button>

            <Link
              to="/wishlist"
              aria-label="Wishlist"
              className="text-gray-700 hover:text-purple-600"
            >
              <Heart size={21} />
            </Link>

            <Link
              to="/cart"
              aria-label="Shopping bag"
              className="text-gray-700 hover:text-purple-600"
            >
              <ShoppingBag size={21} />
            </Link>

            <Link
              to="/login"
              className="hidden sm:block text-sm font-medium text-gray-700 hover:text-purple-600"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="rounded-lg bg-purple-600 text-white px-4 py-2 text-sm font-semibold hover:bg-purple-700 transition"
            >
              Sign Up
            </Link>

            <button
              className="md:hidden text-gray-800"
              aria-label="Menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-6 py-4 flex flex-col gap-4 text-gray-700">
            <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
            <a href="#categories" onClick={() => setMenuOpen(false)}>Categories</a>
            <a href="#products" onClick={() => setMenuOpen(false)}>Products</a>
            <a href="#footer" onClick={() => setMenuOpen(false)}>Contact</a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section
        id="home"
        className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center"
      >
        <div>
          <p className="text-purple-600 uppercase tracking-[3px] font-bold text-sm">
            Technology made simple
          </p>

          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mt-5 text-gray-900">
            Upgrade Your
            <span className="block text-purple-600">Tech Lifestyle.</span>
          </h1>

          <p className="text-gray-600 leading-7 mt-6 max-w-lg">
            Discover premium mobile and laptop accessories
            designed to improve your everyday technology experience.
          </p>

          <Link
            to="/shop"
            className="inline-flex items-center gap-3 bg-purple-600 text-white hover:bg-purple-700 px-7 py-4 rounded-lg mt-8 font-semibold transition shadow-lg shadow-purple-200"
          >
            Explore Products <ArrowRight size={19} />
          </Link>
        </div>

        <img
          src="https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1000"
          alt="Technology accessories"
          className="w-full h-[350px] md:h-[450px] object-cover rounded-2xl border border-gray-200 shadow-xl"
        />
      </section>

      {/* Benefits */}
      <section className="border-y border-gray-200 bg-gray-50">
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
                <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
                  <Icon size={25} />
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="max-w-7xl mx-auto px-6 py-20">
        <p className="text-purple-600 text-sm uppercase tracking-widest font-bold">
          Browse Collection
        </p>

        <h2 className="text-3xl font-extrabold mt-3 mb-10 text-gray-900">
          Shop By Category
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((category, index) => (
            <Link
              to="/shop"
              key={category}
              className="p-7 rounded-xl border border-gray-200 bg-white hover:border-purple-400 hover:shadow-lg transition"
            >
              <span className="text-3xl text-purple-600 font-extrabold">
                0{index + 1}
              </span>

              <h3 className="mt-5 font-semibold text-gray-900">{category}</h3>

              <p className="text-gray-500 text-sm mt-2">
                Explore collection
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Products */}
      <section id="products" className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-purple-600 text-sm uppercase tracking-widest font-bold">
            Featured Collection
          </p>

          <h2 className="text-3xl font-extrabold mt-3 mb-10 text-gray-900">
            Popular Products
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-7">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl transition"
              >
                <div className="relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-56 w-full object-cover"
                  />

                  <button
                    aria-label="Add to wishlist"
                    className="absolute right-4 top-4 p-2 bg-white text-gray-700 rounded-full shadow hover:text-purple-600"
                  >
                    <Heart size={19} />
                  </button>
                </div>

                <div className="p-5">
                  <p className="text-xs text-purple-600 font-semibold">
                    {product.category}
                  </p>

                  <h3 className="font-semibold mt-2 text-gray-900">
                    {product.name}
                  </h3>

                  <div className="flex gap-3 items-center mt-4">
                    <span className="font-bold text-lg text-gray-900">
                      Rs. {product.price.toLocaleString()}
                    </span>

                    <span className="text-gray-400 line-through text-sm">
                      Rs. {product.oldPrice.toLocaleString()}
                    </span>
                  </div>

                  <Link
                    to="/shop"
                    className="block text-center w-full mt-5 py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-semibold transition"
                  >
                    Shop Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="border-t border-gray-200 bg-white py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">
              Lap<span className="text-purple-600">Mob.</span>
            </h2>

            <p className="text-gray-500 text-sm mt-3">
              Your destination for quality tech accessories.
            </p>
          </div>

          <p className="text-gray-500 text-sm">
            © 2026 LapMob. All rights reserved.
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

        <Route path="/admin" element={<AdminDashboardPro />} />

        <Route path="/shop" element={<Shop />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/wishlist" element={<Wishlist />} />

        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center justify-center gap-4">
              <h1 className="text-5xl font-bold">404</h1>
              <p className="text-gray-600">Page not found</p>
              <Link to="/" className="text-purple-600 hover:underline">
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
