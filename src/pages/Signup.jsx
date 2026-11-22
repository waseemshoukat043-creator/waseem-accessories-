
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  User,
  Mail,
  Phone,
  Lock,
  UserPlus,
  Eye,
  EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import { signUpUser } from '../lib/auth'

export default function Signup() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    try {
      setLoading(true)

      const data = await signUpUser(form)

      if (data.user && !data.session) {
        toast.success('Account created! Please verify your email.')
      } else {
        toast.success('Account created successfully!')
      }

      navigate('/login')
    } catch (error) {
      toast.error(error.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full min-w-0 bg-transparent py-3 text-white outline-none placeholder:text-zinc-500'

  const wrapperClass =
    'flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950 px-3 focus-within:border-purple-500'

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-7 shadow-xl">

        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-purple-600 text-white">
            <UserPlus size={27} />
          </div>

          <h1 className="text-3xl font-bold text-white">
            Create Account
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Join LapMob today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Full Name */}
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Full Name
            </label>
            <div className={wrapperClass}>
              <User size={18} className="shrink-0 text-zinc-400" />
              <input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
                className={inputClass}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Email Address
            </label>
            <div className={wrapperClass}>
              <Mail size={18} className="shrink-0 text-zinc-400" />
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                className={inputClass}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Phone Number
            </label>
            <div className={wrapperClass}>
              <Phone size={18} className="shrink-0 text-zinc-400" />
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Enter your phone number"
                required
                className={inputClass}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Password
            </label>
            <div className={wrapperClass}>
              <Lock size={18} className="shrink-0 text-zinc-400" />

              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter password (minimum 8 characters)"
                minLength={8}
                required
                autoComplete="new-password"
                className={inputClass}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="shrink-0 text-zinc-400 hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Confirm Password
            </label>
            <div className={wrapperClass}>
              <Lock size={18} className="shrink-0 text-zinc-400" />

              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                required
                autoComplete="new-password"
                className={inputClass}
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="shrink-0 text-zinc-400 hover:text-white"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-purple-400 hover:text-purple-300">
            Login
          </Link>
        </p>

      </div>
    </div>
  )
}
