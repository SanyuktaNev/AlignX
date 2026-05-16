import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import EmployeeDashboard from './pages/EmployeeDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import CheckinDashboard from './pages/CheckinDashboard'
import AnalyticsDashboard from './pages/AnalyticsDashboard'

function RoleRoute({ children, role }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  if (!profile) return <Navigate to="/" />
  if (profile.role !== role) return <Navigate to="/" />
  return children
}

function AnyRoleRoute({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  if (!profile) return <Navigate to="/" />
  return children
}

function AppRoutes() {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-indigo-600 text-xl">
      Loading...
    </div>
  )

  return (
    <Routes>
      <Route path="/" element={profile ? <Navigate to={`/${profile.role}`} /> : <Login />} />
      <Route path="/employee" element={
        <RoleRoute role="employee"><EmployeeDashboard /></RoleRoute>
      } />
      <Route path="/employee/checkins" element={
        <RoleRoute role="employee"><CheckinDashboard /></RoleRoute>
      } />
      <Route path="/manager" element={
        <RoleRoute role="manager"><ManagerDashboard /></RoleRoute>
      } />
      <Route path="/admin" element={
        <RoleRoute role="admin"><AdminDashboard /></RoleRoute>
      } />
      <Route path="/analytics" element={
        <AnyRoleRoute><AnalyticsDashboard /></AnyRoleRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}