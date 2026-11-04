
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

import Cart from './pages/Cart'
import Wishlist from './pages/Wishlist'
import Checkout from './pages/Checkout'
import Shop from './pages/Shop.jsx'
import AdminDashboardPro from './pages/AdminDashboardPro'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Signup from './pages/Signup'
import Login from './pages/Login'

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
  Database,
  X
} from 'lucide-react'

const COLORS = {
  purple: '#5B3A8E',
  purpleDark: '#452B70',
  lightPurple: '#EDE5F7',
  pista: '#B7D7A8',
  white: '#FFFFFF',
  dark: '#24212B',
  muted: '#6B6573'
}

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
    let active = true

    async function checkConnection() {
      try {
        const result = await testSupabaseConnection()

        if (active) {
          setConnection(result.connected ? 'connected' : 'error')
        }
      } catch (error) {
        console.error('Supabase connection error:', error)

        if (active) {
          setConnection('error')
        }
      }
    }

    checkConnection()

    return () => {
      active = false
    }
  }, [])

  const benefits = [
    {
      icon: Truck,
      title: 'Fast Delivery',
      desc: 'Reliable order delivery'
    },
    {
      icon: ShieldCheck,
      title: 'Secure Shopping',
      desc: 'Safe shopping experience'
    },
    {
      icon: Headphones,
      title: 'Customer Support',
      desc: 'Help when you need it'
    },
    {
      icon: Zap,
      title: 'Quality Products',
      desc: 'Carefully selected gadgets'
    }
  ]

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: COLORS.white,
        color: COLORS.dark
      }}
    >

      {/* DATABASE STATUS */}
      <div
        className="flex justify-center items-center gap-2 px-4 py-3 text-sm"
        style={{
          backgroundColor: COLORS.lightPurple,
          color: COLORS.dark
        }}
      >
        {connection === 'checking' && (
          <>
            <Database size={17} />
            Checking database connection...
          </>
        )}

        {connection === 'connected' && (
          <>
            <CheckCircle size={17} className="text-green-700" />
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

      {/* TOP ANNOUNCEMENT */}
      <div
        className="text-center py-2 px-4 text-sm font-semibold"
        style={{
          backgroundColor: COLORS.purple,
          color: COLORS.white
        }}
      >
        Free Delivery on Orders Above Rs. 5,000
      </div>

      {/* NAVBAR */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: COLORS.white,
          borderColor: '#E5DFEB'
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">

          <Link
            to="/"
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: COLORS.dark }}
          >
            Lap<span style={{ color: COLORS.purple }}>Mob.</span>
          </Link>

          <div className="hidden md:flex gap-8 text-sm font-semibold">
            {[
              ['Home', '#home'],
              ['Categories', '#categories'],
              ['Products', '#products'],
              ['Contact', '#footer']
            ].map(([name, href]) => (
              <a
                key={name}
                href={href}
                className="transition hover:opacity-70"
                style={{ color: COLORS.dark }}
              >
                {name}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">

            <button
              aria-label="Search"
              className="hover:opacity-70"
              style={{ color: COLORS.purple }}
              onClick={() => {
                document.getElementById('products')?.scrollIntoView({
                  behavior: 'smooth'
                })
              }}
            >
              <Search size={21} />
            </button>

            <Link
              to="/wishlist"
              aria-label="Wishlist"
              style={{ color: COLORS.purple }}
            >
              <Heart size={21} />
            </Link>

            <Link
              to="/cart"
              aria-label="Shopping Cart"
              style={{ color: COLORS.purple }}
            >
              <ShoppingBag size={21} />
            </Link>

            <Link
              to="/login"
              className="hidden sm:block text-sm font-semibold"
              style={{ color: COLORS.dark }}
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="hidden sm:block rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{
                backgroundColor: COLORS.purple,
                color: COLORS.white
              }}
            >
              Sign Up
            </Link>

            <button
              className="md:hidden"
              aria-label="Toggle menu"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ color: COLORS.purple }}
            >
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        {menuOpen && (
          <div
            className="md:hidden border-t px-6 py-5 flex flex-col gap-4"
            style={{
              backgroundColor: COLORS.white,
              borderColor: '#E5DFEB'
            }}
          >
            {[
              ['Home', '#home'],
              ['Categories', '#categories'],
              ['Products', '#products'],
              ['Contact', '#footer']
            ].map(([name, href]) => (
              <a
                key={name}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="font-medium"
                style={{ color: COLORS.dark }}
              >
                {name}
              </a>
            ))}

            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              style={{ color: COLORS.purple }}
            >
              Login
            </Link>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <section
        id="home"
        className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center"
      >
        <div>
          <span
            className="inline-block rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest"
            style={{
              backgroundColor: COLORS.lightPurple,
              color: COLORS.purple
            }}
          >
            Technology Made Simple
          </span>

          <h1
            className="text-5xl md:text-6xl font-extrabold leading-tight mt-6"
            style={{ color: COLORS.dark }}
          >
            Upgrade Your
            <span
              className="block mt-2"
              style={{ color: COLORS.purple }}
            >
              Tech Lifestyle.
            </span>
          </h1>

          <p
            className="leading-8 mt-6 max-w-lg"
            style={{ color: COLORS.muted }}
          >
            Discover premium mobile and laptop accessories
            designed to improve your everyday technology experience.
            Find quality products at affordable prices with LapMob.
          </p>

          <div className="flex flex-wrap gap-4 mt-8">

            <Link
              to="/shop"
              className="inline-flex items-center gap-3 px-7 py-4 rounded-xl font-bold shadow-lg transition hover:opacity-90"
              style={{
                backgroundColor: COLORS.purple,
                color: COLORS.white
              }}
            >
              Explore Products
              <ArrowRight size={19} />
            </Link>

            <a
              href="#categories"
              className="inline-flex items-center px-7 py-4 rounded-xl font-bold border transition hover:opacity-80"
              style={{
                backgroundColor: COLORS.white,
                color: COLORS.purple,
                borderColor: COLORS.purple
              }}
            >
              Browse Categories
            </a>
          </div>

          <div className="flex items-center gap-3 mt-9">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: COLORS.pista }}
            />
            <p className="text-sm font-medium" style={{ color: COLORS.muted }}>
              Quality Accessories. Better Technology.
            </p>
          </div>
        </div>

        <div className="relative">
          <div
            className="absolute -inset-4 rounded-3xl -z-10"
            style={{ backgroundColor: COLORS.lightPurple }}
          />

          <img
            src="https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1000"
            alt="LapMob technology accessories"
            className="w-full h-[350px] md:h-[470px] object-cover rounded-2xl shadow-xl"
          />

          <div
            className="absolute bottom-5 left-5 right-5 rounded-xl p-4 shadow-lg"
            style={{
              backgroundColor: COLORS.white,
              color: COLORS.dark
            }}
          >
            <p className="font-bold">Explore Latest Technology</p>
            <p className="text-sm mt-1" style={{ color: COLORS.muted }}>
              Discover accessories for your everyday needs.
            </p>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section
        className="border-y"
        style={{
          backgroundColor: '#F9F7FC',
          borderColor: '#E5DFEB'
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          {benefits.map((item) => {
            const Icon = item.icon

            return (
              <div key={item.title} className="flex items-center gap-4">
                <div
                  className="p-3 rounded-xl"
                  style={{
                    backgroundColor: COLORS.lightPurple,
                    color: COLORS.purple
                  }}
                >
                  <Icon size={25} />
                </div>

                <div>
                  <h3 className="font-bold" style={{ color: COLORS.dark }}>
                    {item.title}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: COLORS.muted }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* CATEGORIES */}
      <section
        id="categories"
        className="max-w-7xl mx-auto px-6 py-20"
      >
        <p
          className="text-sm uppercase tracking-widest font-bold"
          style={{ color: COLORS.purple }}
        >
          Browse Collection
        </p>

        <h2
          className="text-3xl md:text-4xl font-extrabold mt-3 mb-10"
          style={{ color: COLORS.dark }}
        >
          Shop By Category
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {categories.map((category, index) => (
            <Link
              to="/shop"
              key={category}
              className="p-7 rounded-2xl border transition hover:-translate-y-1 hover:shadow-lg"
              style={{
                backgroundColor: COLORS.white,
                borderColor: '#E5DFEB'
              }}
            >
              <span
                className="text-3xl font-extrabold"
                style={{ color: COLORS.purple }}
              >
                0{index + 1}
              </span>

              <h3
                className="mt-5 font-bold"
                style={{ color: COLORS.dark }}
              >
                {category}
              </h3>

              <p
                className="text-sm mt-2"
                style={{ color: COLORS.muted }}
              >
                Explore collection
              </p>

              <div
                className="mt-5 h-1 w-10 rounded-full"
                style={{ backgroundColor: COLORS.pista }}
              />
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section
        id="products"
        className="py-20 border-y"
        style={{
          backgroundColor: '#F9F7FC',
          borderColor: '#E5DFEB'
        }}
      >
        <div className="max-w-7xl mx-auto px-6">

          <p
            className="text-sm uppercase tracking-widest font-bold"
            style={{ color: COLORS.purple }}
          >
            Featured Collection
          </p>

          <h2
            className="text-3xl md:text-4xl font-extrabold mt-3 mb-10"
            style={{ color: COLORS.dark }}
          >
            Popular Products
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-7">
            {products.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl overflow-hidden border transition hover:-translate-y-1 hover:shadow-xl"
                style={{
                  backgroundColor: COLORS.white,
                  borderColor: '#E5DFEB'
                }}
              >
                <div className="relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-56 w-full object-cover"
                    loading="lazy"
                  />

                  <button
                    aria-label="Open wishlist"
                    onClick={() => window.location.assign('/wishlist')}
                    className="absolute right-4 top-4 p-2 rounded-full shadow"
                    style={{
                      backgroundColor: COLORS.white,
                      color: COLORS.purple
                    }}
                  >
                    <Heart size={19} />
                  </button>
                </div>

                <div className="p-5">
                  <p
                    className="text-xs font-semibold"
                    style={{ color: COLORS.purple }}
                  >
                    {product.category}
                  </p>

                  <h3
                    className="font-bold mt-2"
                    style={{ color: COLORS.dark }}
                  >
                    {product.name}
                  </h3>

                  <div className="flex gap-3 items-center mt-4">
                    <span
                      className="font-extrabold text-lg"
                      style={{ color: COLORS.dark }}
                    >
                      Rs. {product.price.toLocaleString()}
                    </span>

                    <span
                      className="line-through text-sm"
                      style={{ color: '#918A99' }}
                    >
                      Rs. {product.oldPrice.toLocaleString()}
                    </span>
                  </div>

                  <Link
                    to="/shop"
                    className="block text-center w-full mt-5 py-3 rounded-lg font-bold transition hover:opacity-90"
                    style={{
                      backgroundColor: COLORS.purple,
                      color: COLORS.white
                    }}
                  >
                    Shop Now
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 font-bold rounded-lg px-7 py-3"
              style={{
                backgroundColor: COLORS.pista,
                color: COLORS.dark
              }}
            >
              View All Products
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div
          className="rounded-3xl p-8 md:p-12 flex flex-col md:flex-row justify-between items-center gap-8"
          style={{
            backgroundColor: COLORS.purple,
            color: COLORS.white
          }}
        >
          <div>
            <h2 className="text-3xl font-extrabold text-white">
              Ready to Upgrade Your Tech?
            </h2>
            <p className="mt-3 text-white/90">
              Explore the LapMob collection and find your next favourite accessory.
            </p>
          </div>

          <Link
            to="/shop"
            className="inline-flex items-center gap-3 rounded-xl px-7 py-4 font-bold whitespace-nowrap"
            style={{
              backgroundColor: COLORS.pista,
              color: COLORS.dark
            }}
          >
            Shop Now
            <ArrowRight size={19} />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        id="footer"
        className="border-t py-12 px-6"
        style={{
          backgroundColor: COLORS.white,
          borderColor: '#E5DFEB'
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6">

          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: COLORS.dark }}>
              Lap<span style={{ color: COLORS.purple }}>Mob.</span>
            </h2>

            <p className="text-sm mt-3" style={{ color: COLORS.muted }}>
              Your destination for quality tech accessories.
            </p>
          </div>

          <div className="flex flex-wrap gap-5 text-sm font-medium">
            <Link to="/shop" style={{ color: COLORS.dark }}>Shop</Link>
            <Link to="/wishlist" style={{ color: COLORS.dark }}>Wishlist</Link>
            <Link to="/cart" style={{ color: COLORS.dark }}>Cart</Link>
            <Link to="/login" style={{ color: COLORS.dark }}>Login</Link>
          </div>

          <p className="text-sm" style={{ color: COLORS.muted }}>
            © {new Date().getFullYear()} LapMob. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

// MAIN APP ROUTING
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
            <div
              className="min-h-screen flex flex-col items-center justify-center gap-4"
              style={{
                backgroundColor: COLORS.lightPurple,
                color: COLORS.dark
              }}
            >
              <h1 className="text-6xl font-extrabold">404</h1>

              <p style={{ color: COLORS.muted }}>
                Page not found
              </p>

              <Link
                to="/"
                className="rounded-lg px-6 py-3 font-semibold"
                style={{
                  backgroundColor: COLORS.purple,
                  color: COLORS.white
                }}
              >
                Back to LapMob
              </Link>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
