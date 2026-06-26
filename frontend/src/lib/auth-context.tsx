"use client"

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react"
import { getMe, User, clearToken } from "./api"
import { useRouter } from "next/navigation"

interface AuthContextType {
  user: User | null
  loading: boolean
  logout: () => void
  loadSession: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
  loadSession: async () => null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const loadSession = useCallback(async () => {
    try {
      const u = await getMe()
      setUser(u)
      return u
    } catch {
      clearToken()
      setUser(null)
      router.push("/auth/login")
      return null
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const logout = () => {
    clearToken()
    setUser(null)
    router.push("/auth/login")
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, loadSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
