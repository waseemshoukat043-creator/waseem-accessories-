
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { updatePassword } from '../lib/auth'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    try {
      setLoading(true)
      await updatePassword(password)

      toast.success('Password updated successfully!')
      navigate('/login')
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
          <Lock size={27} />
        </div>

        <h1 className="text-center text-3xl font-bold text-white">
          Reset Password
        </h1>

        <p className="mt-3 mb-7 text-center text-sm text-zinc-400">
          Create a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">

          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-blue-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
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
