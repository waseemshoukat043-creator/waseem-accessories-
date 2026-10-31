
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import { loginUser } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setLoading(true)

      // Login user with Supabase
      const data = await loginUser(email, password)
      const user = data.user

      if (!user) {
        throw new Error('User information not found.')
      }

      // Get user's role from profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) {
        throw new Error('Unable to verify account role: ' + error.message)
      }

      toast.success('Login successful!')

      // Redirect according to user role
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
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-7 shadow-xl">

        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600">
            <LogIn size={27} />
          </div>

          <h1 className="text-3xl font-bold text-white">
            Welcome Back
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            Login to your WaseemTech account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Email Address
            </label>

            <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950 px-3">
              <Mail size={18} className="text-zinc-400" />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full bg-transparent py-3 text-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Password
            </label>

            <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950 px-3">
              <Lock size={18} className="text-zinc-400" />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full bg-transparent py-3 text-white outline-none"
              />
            </div>
          </div>

          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-sm text-blue-400"
            >
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="font-semibold text-blue-400"
          >
            Sign Up
          </Link>
        </p>

      </div>
    </div>
  )
}
