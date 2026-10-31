
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Phone, Lock, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { signUpUser } from '../lib/auth'

export default function Signup() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
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
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { name: 'fullName', label: 'Full Name', icon: User, type: 'text' },
    { name: 'email', label: 'Email Address', icon: Mail, type: 'email' },
    { name: 'phone', label: 'Phone Number', icon: Phone, type: 'tel' },
    { name: 'password', label: 'Password', icon: Lock, type: 'password' },
    { name: 'confirmPassword', label: 'Confirm Password', icon: Lock, type: 'password' }
  ]

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-7 shadow-xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600">
            <UserPlus size={27} />
          </div>
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Join WaseemTech-Accessories today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(({ name, label, icon: Icon, type }) => (
            <div key={name}>
              <label className="mb-2 block text-sm text-zinc-300">
                {label}
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-950 px-3">
                <Icon size={18} className="text-zinc-400" />
                <input
                  type={type}
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  placeholder={label}
                  required
                  className="w-full bg-transparent py-3 text-white outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-blue-400">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
