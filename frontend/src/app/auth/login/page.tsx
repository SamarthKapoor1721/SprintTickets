"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
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

  const inputCls =
    "w-full h-11 px-3.5 rounded-[10px] border border-[#e2e8f0] bg-white text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/12"

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fa] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-[400px]"
      >
        <div className="mb-7 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.ico" alt="Sprint Tickets logo" className="mb-4 h-11 w-11 rounded-[11px] object-contain" />
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-1.5 text-[14px] text-slate-500">Sign in to your Sprint Tickets workspace.</p>
        </div>

        <div className="rounded-[16px] border border-[#eef2f7] bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-12px_rgba(16,24,40,0.12)]">
          {error && (
            <div className="mb-5 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-600">Work email</label>
              <input
                type="email"
                placeholder="you@company.com"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[13px] font-medium text-slate-600">Password</label>
                <Link href="/auth/forgot-password" className="text-[12.5px] font-medium text-primary hover:underline">
                  Forgot?
                </Link>
              </div>
              <input
                type="password"
                placeholder="••••••••••"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="!mt-5 h-11 w-full rounded-[10px] bg-primary text-[14.5px] font-semibold text-white shadow-lg shadow-primary/28 transition-all hover:bg-blue-700 active:translate-y-px disabled:opacity-60 cursor-pointer"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">© 2026 Sprint Tickets · Internal use only</div>
      </motion.div>
    </div>
  )
}
