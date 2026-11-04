
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Mail,
  Lock,
  LogIn,
  Eye,
  EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import { loginUser } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setLoading(true)

      const data = await loginUser(email, password)
      const user = data.user

      if (!user) {
        throw new Error('User information not found.')
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) {
        throw new Error(
          'Unable to verify account role: ' + error.message
        )
      }

      toast.success('Login successful!')

      if (profile.role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/shop', { replace: true })
      }

    } catch (error) {
      toast.error(error.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9F6] flex items-center justify-center px-4 py-8">

      <div className="w-full max-w-md rounded-2xl border border-[#E8E3ED] bg-white p-7 shadow-xl">

        {/* Logo and Heading */}
        <div className="mb-7 text-center">

          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#5B3A8E] text-white shadow-lg">
            <LogIn size={29} />
          </div>

          <h1 className="text-3xl font-bold text-[#24212B]">
            Welcome Back
          </h1>

          <p className="mt-2 text-sm text-[#716B7B]">
            Login to your LapMob account
          </p>

        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#24212B]">
              Email Address
            </label>

            <div className="flex items-center gap-3 rounded-xl border border-[#E8E3ED] bg-[#F8F9FC] px-3 transition focus-within:border-[#5B3A8E] focus-within:ring-2 focus-within:ring-[#5B3A8E]/10">

              <Mail size={19} className="shrink-0 text-[#716B7B]" />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
                className="w-full bg-transparent py-3 text-[#24212B] outline-none placeholder:text-[#9A94A2]"
              />

            </div>
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#24212B]">
              Password
            </label>

            <div className="flex items-center gap-3 rounded-xl border border-[#E8E3ED] bg-[#F8F9FC] px-3 transition focus-within:border-[#5B3A8E] focus-within:ring-2 focus-within:ring-[#5B3A8E]/10">

              <Lock size={19} className="shrink-0 text-[#716B7B]" />

              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className="w-full bg-transparent py-3 text-[#24212B] outline-none placeholder:text-[#9A94A2]"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="shrink-0 rounded-md p-1 text-[#716B7B] transition hover:bg-[#EDE5F7] hover:text-[#5B3A8E]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>

            </div>
          </div>

          {/* Forgot Password */}
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-[#5B3A8E] hover:text-[#482B75]"
            >
              Forgot Password?
            </Link>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#5B3A8E] py-3.5 font-semibold text-white shadow-md transition hover:bg-[#482B75] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login to LapMob'}
          </button>

        </form>

        {/* Signup Link */}
        <p className="mt-7 text-center text-sm text-[#716B7B]">
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="font-bold text-[#5B3A8E] hover:text-[#482B75]"
          >
            Sign Up
          </Link>
        </p>

      </div>
    </div>
  )
}
