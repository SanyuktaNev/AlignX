import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('demo_user')
    if (saved) {
      setProfile(JSON.parse(saved))
    }
    setLoading(false)
  }, [])

  const login = async (email) => {
    console.log('Trying to login with:', email)

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())

    console.log('Supabase response:', data, error)

    if (error) throw new Error('Database error: ' + error.message)
    if (!data || data.length === 0) throw new Error('User not found — check if seed data exists')

    const user = data[0]
    setProfile(user)
    localStorage.setItem('demo_user', JSON.stringify(user))
    return user
  }

  const logout = () => {
    setProfile(null)
    localStorage.removeItem('demo_user')
  }

  return (
    <AuthContext.Provider value={{ profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)