import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const demoUsers = [
    { label: 'Login as Employee', email: 'employee@demo.com' },
    { label: 'Login as Manager', email: 'manager@demo.com' },
    { label: 'Login as Admin', email: 'admin@demo.com' },
  ]

  const handleLogin = async (loginEmail) => {
    setLoading(true)
    setError('')
    try {
      const profile = await login(loginEmail || email, 'demo')
      if (profile.role === 'employee') navigate('/employee')
      else if (profile.role === 'manager') navigate('/manager')
      else navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-700">AlignX</h1>
          <p className="text-gray-500 mt-1">Goal Setting & Tracking Portal</p>
        </div>

        {/* Quick Demo Buttons */}
        <div className="space-y-3 mb-6">
          <p className="text-sm text-gray-500 text-center font-medium">Quick Demo Login</p>
          {demoUsers.map((u) => (
            <button
              key={u.email}
              onClick={() => handleLogin(u.email)}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 transition text-indigo-700 font-medium"
            >
              {u.label}
            </button>
          ))}
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-3 text-gray-400">or enter email</span>
          </div>
        </div>

        {/* Manual Email */}
        <div className="space-y-3">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={() => handleLogin()}
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>

      </div>
    </div>
  )
}