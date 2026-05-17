import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('alignx_user')
    if (saved) {
      setProfile(JSON.parse(saved))
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    if (!email || !password) throw new Error('Please enter email and password.')

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('password', password)

    if (error) throw new Error('Something went wrong. Try again.')
    if (!data || data.length === 0) throw new Error('Invalid email or password.')

    const user = data[0]
    setProfile(user)
    localStorage.setItem('alignx_user', JSON.stringify(user))
    return user
  }

  const logout = () => {
    setProfile(null)
    localStorage.removeItem('alignx_user')
  }

  return (
    <AuthContext.Provider value={{ profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)