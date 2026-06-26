"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.ico"
            alt="Sprint Tickets logo"
            className="mb-5 h-12 w-12 rounded-xl object-contain shadow-lg shadow-primary/20"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sprint Tickets</h1>
          <p className="mt-1.5 text-sm text-slate-500">Sign in to your workspace</p>
        </div>

        <div className="glass rounded-2xl p-7">
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500">Work Email</Label>
              <Input 
                type="email" 
                placeholder="name@company.com" 
                className="rounded-xl border-slate-200 bg-slate-50" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500">Password</Label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                className="rounded-xl border-slate-200 bg-slate-50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="mt-6 h-11 w-full rounded-xl bg-primary text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] cursor-pointer"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

        </div>
      </motion.div>
    </div>
  )
}
