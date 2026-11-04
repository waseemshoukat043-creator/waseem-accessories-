
import { useEffect, useState, useCallback } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Link
} from 'react-router-dom'

import Cart from './pages/Cart'
import Wishlist from './pages/Wishlist'
import Checkout from './pages/Checkout'
import Shop from './pages/Shop.jsx'
import AdminDashboardPro from './pages/AdminDashboardPro'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Signup from './pages/Signup'
import Login from './pages/Login'

import {
  supabase,
  testSupabaseConnection
} from './lib/supabase'

import {
  Search,
  ShoppingBag,
  Menu,
  X,
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

// LapMob Color Theme
const COLORS = {
  purple: '#5B3A8E',
  purpleDark: '#452B70',
  lightPurple: '#EDE5F7',
  pista: '#B7D7A8',
  white: '#FFFFFF',
  dark: '#24212B',
  muted: '#6B6573',
  background: '#F8F9F6'
}

// Homepage demo products
const products = [
  {
    id: 1,
    name: 'Wireless Headphones',
    category: 'Audio Accessories',
    price: 4500,
    oldPrice: 5500,
    image:
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'
  },
  {
    id: 2,
    name: 'Premium Smart Watch',
    category: 'Smart Gadgets',
    price: 6500,
    oldPrice: 7500,
    image:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'
  },
  {
    id: 3,
    name: 'Wireless Keyboard',
    category: 'Laptop Accessories',
    price: 3500,
    oldPrice: 4200,
    image:
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600'
  },
  {
    id: 4,
    name: 'Premium Mouse',
    category: 'Computer Accessories',
    price: 2200,
    oldPrice: 2800,
    image:
      'https://images.unsplash.com/photo-1527814050087-3793815479db?w=600'
  }
]

const categories = [
  'Mobile Accessories',
  'Laptop Accessories',
  'Headphones',
  'Smart Gadgets'
]

// Reusable button styling
const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#5B3A8E] px-6 py-3 font-semibold text-white transition hover:bg-[#452B70]'

const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[#5B3A8E] px-6 py-3 font-semibold text-[#5B3A8E] transition hover:bg-[#EDE5F7]'

// Homepage
function HomePage() {
  const [connection, setConnection] = useState('checking')
  const [cartCount, setCartCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Supabase connection check
  useEffect(() => {
    let mounted = true

    async function checkConnection() {
      try {
        const result = await testSupabaseConnection()

        if (mounted) {
          setConnection(result.connected ? 'connected' : 'error')
        }
      } catch (error) {
        console.error('Supabase connection error:', error)

        if (mounted) {
          setConnection('error')
        }
      }
    }

    checkConnection()

    return () => {
      mounted = false
    }
  }, [])

  // Load logged-in user's cart quantity
  const fetchCartCount = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setCartCount(0)
        return
      }

      const { data, error } = await supabase
        .from('cart_items')
        .select('quantity')
        .eq('user_id', user.id)

      if (error) {
        console.error('Cart count error:', error)
        return
      }

      const total = (data || []).reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      )

      setCartCount(total)
    } catch (error) {
      console.error('Unable to load cart count:', error)
    }
  }, [])

  useEffect(() => {
    fetchCartCount()

    // Refresh when user logs in or logs out
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      fetchCartCount()
    })

    // Listen for cart changes from other components
    const handleCartUpdate = () => fetchCartCount()

    window.addEventListener('cart-updated', handleCartUpdate)
    window.addEventListener('focus', handleCartUpdate)

    // Supabase realtime updates
    const channel = supabase
      .channel('lapmob-cart-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cart_items'
        },
        () => fetchCartCount()
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('cart-updated', handleCartUpdate)
      window.removeEventListener('focus', handleCartUpdate)
      supabase.removeChannel(channel)
    }
  }, [fetchCartCount])

  const scrollToProducts = () => {
    document.getElementById('products')?.scrollIntoView({
      behavior: 'smooth'
    })
    setMobileMenuOpen(false)
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: COLORS.background,
        color: COLORS.dark
      }}
    >
      {/* Supabase Status */}
      <div
        className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium"
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
            <CheckCircle size={17} color="#27834B" />
            Supabase Connected Successfully
          </>
        )}

        {connection === 'error' && (
          <>
            <AlertCircle size={17} color="#C0392B" />
            Supabase Connection Failed
          </>
        )}
      </div>

      {/* Announcement Bar */}
      <div
        className="py-2 text-center text-sm font-semibold"
        style={{
          backgroundColor: COLORS.purple,
          color: COLORS.white
        }}
      >
        <Truck size={16} className="mr-2 inline" />
        Free delivery on orders above Rs. 5,000
      </div>

      {/* Navbar */}
      <nav
        className="sticky top-0 z-50 border-b shadow-sm"
        style={{
          backgroundColor: COLORS.white,
          borderColor: COLORS.lightPurple
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-6">

          {/* Logo */}
          <Link
            to="/"
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: COLORS.dark }}
          >
            Lap<span style={{ color: COLORS.purple }}>Mob.</span>
          </Link>

          {/* Desktop Navigation */}
          <div
            className="hidden items-center gap-8 text-sm font-semibold md:flex"
            style={{ color: COLORS.dark }}
          >
            <a href="#home" className="transition hover:text-[#5B3A8E]">
              Home
            </a>

            <a href="#categories" className="transition hover:text-[#5B3A8E]">
              Categories
            </a>

            <a href="#products" className="transition hover:text-[#5B3A8E]">
              Products
            </a>

            <a href="#footer" className="transition hover:text-[#5B3A8E]">
              Contact
            </a>
          </div>

          {/* Navbar Actions */}
          <div className="flex items-center gap-4">

            <button
              aria-label="Search products"
              onClick={scrollToProducts}
              className="rounded-lg p-2 transition hover:bg-[#EDE5F7]"
              style={{ color: COLORS.purple }}
            >
              <Search size={21} />
            </button>

            {/* Cart with quantity badge */}
            <Link
              to="/cart"
              aria-label={`Shopping cart, ${cartCount} items`}
              className="relative rounded-lg p-2 transition hover:bg-[#EDE5F7]"
              style={{ color: COLORS.purple }}
            >
              <ShoppingBag size={23} />

              {cartCount > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold"
                  style={{
                    backgroundColor: COLORS.pista,
                    color: COLORS.dark
                  }}
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>

            <Link
              to="/login"
              className="hidden text-sm font-semibold transition hover:opacity-70 sm:block"
              style={{ color: COLORS.dark }}
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="hidden rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 sm:block"
              style={{
                backgroundColor: COLORS.purple,
                color: COLORS.white
              }}
            >
              Sign Up
            </Link>

            {/* Mobile Menu Button */}
            <button
              className="rounded-lg p-2 md:hidden"
              style={{ color: COLORS.purple }}
              aria-label="Toggle menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div
            className="border-t px-6 py-5 md:hidden"
            style={{
              backgroundColor: COLORS.white,
              borderColor: COLORS.lightPurple
            }}
          >
            <div className="flex flex-col gap-4 font-semibold">
              <a
                href="#home"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: COLORS.dark }}
              >
                Home
              </a>

              <a
                href="#categories"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: COLORS.dark }}
              >
                Categories
              </a>

              <a
                href="#products"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: COLORS.dark }}
              >
                Products
              </a>

              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: COLORS.dark }}
              >
                Login
              </Link>

              <Link
                to="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-4 py-3 text-center"
                style={{
                  backgroundColor: COLORS.purple,
                  color: COLORS.white
                }}
              >
                Create Account
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section
        id="home"
        className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24"
      >
        <div>
          <p
            className="text-sm font-bold uppercase tracking-[3px]"
            style={{ color: COLORS.purple }}
          >
            Technology made simple
          </p>

          <h1
            className="mt-5 text-5xl font-extrabold leading-tight md:text-6xl"
            style={{ color: COLORS.dark }}
          >
            Upgrade Your
            <span
              className="mt-2 block"
              style={{ color: COLORS.purple }}
            >
              Tech Lifestyle.
            </span>
          </h1>

          <p
            className="mt-6 max-w-lg text-base leading-8"
            style={{ color: COLORS.muted }}
          >
            Discover premium mobile and laptop accessories
            designed to improve your everyday technology experience.
            Quality products, reliable service and a better shopping experience.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/shop" className={primaryButton}>
              Explore Products
              <ArrowRight size={19} />
            </Link>

            <a href="#categories" className={secondaryButton}>
              Browse Categories
            </a>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-6 text-sm font-medium">
            <span className="flex items-center gap-2">
              <CheckCircle size={18} color="#5B3A8E" />
              Quality Products
            </span>

            <span className="flex items-center gap-2">
              <ShieldCheck size={18} color="#5B3A8E" />
              Secure Shopping
            </span>
          </div>
        </div>

        <div className="relative">
          <div
            className="absolute -left-5 -top-5 h-28 w-28 rounded-2xl"
            style={{ backgroundColor: COLORS.pista }}
          />

          <img
            src="https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1000"
            alt="LapMob technology accessories"
            className="relative z-10 h-[350px] w-full rounded-2xl object-cover shadow-xl md:h-[460px]"
          />

          <div
            className="absolute -bottom-5 -right-4 z-20 rounded-xl px-5 py-4 shadow-lg"
            style={{
              backgroundColor: COLORS.purple,
              color: COLORS.white
            }}
          >
            <p className="text-sm font-medium">Discover More</p>
            <p className="text-xl font-bold">LapMob Collection</p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section
        className="border-y py-12"
        style={{
          backgroundColor: COLORS.lightPurple,
          borderColor: '#DDD0EE'
        }}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 sm:grid-cols-2 md:grid-cols-4">

          {[
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
          ].map((item) => {
            const Icon = item.icon

            return (
              <div
                key={item.title}
                className="flex items-center gap-4"
              >
                <div
                  className="rounded-xl p-3"
                  style={{
                    backgroundColor: COLORS.purple,
                    color: COLORS.white
                  }}
                >
                  <Icon size={25} />
                </div>

                <div>
                  <h3
                    className="font-bold"
                    style={{ color: COLORS.dark }}
                  >
                    {item.title}
                  </h3>

                  <p
                    className="mt-1 text-sm"
                    style={{ color: COLORS.muted }}
                  >
                    {item.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Categories */}
      <section
        id="categories"
        className="mx-auto max-w-7xl px-6 py-20"
      >
        <p
          className="text-sm font-bold uppercase tracking-widest"
          style={{ color: COLORS.purple }}
        >
          Browse Collection
        </p>

        <div className="mb-10 mt-3 flex flex-wrap items-end justify-between gap-4">
          <h2
            className="text-3xl font-extrabold md:text-4xl"
            style={{ color: COLORS.dark }}
          >
            Shop By Category
          </h2>

          <Link
            to="/shop"
            className="font-semibold hover:underline"
            style={{ color: COLORS.purple }}
          >
            View All Products →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {categories.map((category, index) => (
            <Link
              to="/shop"
              key={category}
              className="rounded-2xl border bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{ borderColor: '#E7E0ED' }}
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
                className="mt-2 text-sm"
                style={{ color: COLORS.muted }}
              >
                Explore collection
              </p>

              <div
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold"
                style={{ color: COLORS.purple }}
              >
                Explore <ArrowRight size={16} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section
        id="products"
        className="py-20"
        style={{ backgroundColor: COLORS.lightPurple }}
      >
        <div className="mx-auto max-w-7xl px-6">
          <p
            className="text-sm font-bold uppercase tracking-widest"
            style={{ color: COLORS.purple }}
          >
            Featured Collection
          </p>

          <div className="mb-10 mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2
              className="text-3xl font-extrabold md:text-4xl"
              style={{ color: COLORS.dark }}
            >
              Popular Products
            </h2>

            <Link to="/shop" className={secondaryButton}>
              View All Products
              <ArrowRight size={17} />
            </Link>
          </div>

          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                style={{ borderColor: '#E7E0ED' }}
              >
                <div className="relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-56 w-full object-cover"
                  />

                  <Link
                    to="/wishlist"
                    aria-label="Open wishlist"
                    className="absolute right-4 top-4 rounded-full p-2.5 shadow-md transition hover:scale-105"
                    style={{
                      backgroundColor: COLORS.white,
                      color: COLORS.purple
                    }}
                  >
                    <Heart size={19} />
                  </Link>
                </div>

                <div className="p-5">
                  <p
                    className="text-xs font-bold"
                    style={{ color: COLORS.purple }}
                  >
                    {product.category}
                  </p>

                  <h3
                    className="mt-2 font-bold"
                    style={{ color: COLORS.dark }}
                  >
                    {product.name}
                  </h3>

                  <div className="mt-4 flex items-center gap-3">
                    <span
                      className="text-lg font-extrabold"
                      style={{ color: COLORS.dark }}
                    >
                      Rs. {product.price.toLocaleString()}
                    </span>

                    <span
                      className="text-sm line-through"
                      style={{ color: '#99919F' }}
                    >
                      Rs. {product.oldPrice.toLocaleString()}
                    </span>
                  </div>

                  <Link
                    to="/shop"
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold transition hover:opacity-90"
                    style={{
                      backgroundColor: COLORS.purple,
                      color: COLORS.white
                    }}
                  >
                    Shop Now
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call To Action */}
      <section className="px-6 py-20">
        <div
          className="mx-auto max-w-7xl rounded-3xl px-7 py-14 text-center md:px-16"
          style={{
            backgroundColor: COLORS.purple,
            color: COLORS.white
          }}
        >
          <h2 className="text-3xl font-extrabold md:text-4xl">
            Upgrade Your Tech Experience
          </h2>

          <p className="mx-auto mt-4 max-w-2xl leading-7 text-white">
            Find the accessories you need and enjoy a better
            technology experience with LapMob.
          </p>

          <Link
            to="/shop"
            className="mt-8 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 font-bold transition hover:opacity-90"
            style={{
              backgroundColor: COLORS.pista,
              color: COLORS.dark
            }}
          >
            Start Shopping
            <ArrowRight size={19} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        id="footer"
        className="px-6 py-14"
        style={{
          backgroundColor: COLORS.purpleDark,
          color: COLORS.white
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row">

          <div>
            <h2 className="text-3xl font-extrabold">
              Lap<span style={{ color: COLORS.pista }}>Mob.</span>
            </h2>

            <p className="mt-3 max-w-sm text-sm leading-7 text-white">
              Your destination for quality mobile and laptop
              accessories. Discover technology made simple.
            </p>
          </div>

          <div>
            <h3 className="font-bold">Quick Links</h3>

            <div className="mt-4 flex flex-col gap-3 text-sm text-white">
              <Link to="/" className="hover:underline">Home</Link>
              <Link to="/shop" className="hover:underline">Shop</Link>
              <Link to="/wishlist" className="hover:underline">Wishlist</Link>
              <Link to="/cart" className="hover:underline">Cart</Link>
              <Link to="/login" className="hover:underline">Login</Link>
            </div>
          </div>
        </div>

        <div
          className="mx-auto mt-10 max-w-7xl border-t pt-6 text-center text-sm text-white"
          style={{ borderColor: '#755A99' }}
        >
          © {new Date().getFullYear()} LapMob. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

// Main App with existing routes preserved
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
              className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center"
              style={{
                backgroundColor: COLORS.background,
                color: COLORS.dark
              }}
            >
              <h1
                className="text-6xl font-extrabold"
                style={{ color: COLORS.purple }}
              >
                404
              </h1>

              <p style={{ color: COLORS.muted }}>
                Page not found
              </p>

              <Link to="/" className={primaryButton}>
                <ArrowRight size={17} className="rotate-180" />
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
