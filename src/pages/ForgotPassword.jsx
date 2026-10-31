
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { forgotPassword } from '../lib/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      setLoading(true)
      await forgotPassword(email)
      toast.success('Password reset link sent! Check your email.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-7">

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600">
          <Mail size={27} />
        </div>

        <h1 className="text-center text-3xl font-bold text-white">
          Forgot Password?
        </h1>

        <p className="mt-3 mb-7 text-center text-sm text-zinc-400">
          Enter your registered email to receive a password reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Email Address
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={18} />
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <Link
          to="/login"
          className="mt-6 flex items-center justify-center gap-2 text-sm text-blue-400"
        >
          <ArrowLeft size={16} />
          Back to Login
        </Link>

      </div>
    </div>
  )
}
