import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogOut, Target, BarChart2 } from 'lucide-react'

export default function Navbar() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const homeRoute = `/${profile?.role}`
  const isAnalytics = location.pathname === '/analytics'

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <button
          onClick={() => navigate(homeRoute)}
          className="flex items-center gap-2"
        >
          <Target className="text-indigo-600" size={24} />
          <span className="text-xl font-bold text-indigo-700">AlignX</span>
        </button>

        <button
          onClick={() => navigate('/analytics')}
          className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition ${
            isAnalytics
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
          }`}
        >
          <BarChart2 size={15} />
          Analytics
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-700">{profile?.name}</p>
          <p className="text-xs text-gray-400 capitalize">{profile?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition"
        >
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  )
}