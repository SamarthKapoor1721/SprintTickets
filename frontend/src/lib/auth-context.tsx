"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { getMe, User, clearToken } from "./api"
import { useRouter } from "next/navigation"

interface AuthContextType {
  user: User | null
  loading: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u)
        setLoading(false)
      })
      .catch(() => {
        clearToken()
        setUser(null)
        setLoading(false)
        router.push("/auth/login")
      })
  }, [router])

  const logout = () => {
    clearToken()
    setUser(null)
    router.push("/auth/login")
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
