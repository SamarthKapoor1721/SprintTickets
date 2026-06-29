"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { onboard } from "@/lib/api"
import { PasswordField } from "@/components/password-field"

function OnboardForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  if (!token) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Invalid or missing onboarding token.
        </div>
      </div>
    )
  }

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)
    try {
      await onboard(token, password)
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed.")
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome!</h1>
          <p className="mt-1.5 text-sm text-slate-500">Set a password to join the workspace.</p>
        </div>

        <div className="glass rounded-2xl p-7">
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleOnboard} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500">Password</Label>
              <PasswordField
                placeholder="••••••••"
                className="rounded-xl border-slate-200 bg-slate-50"
                value={password}
                onChange={setPassword}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500">Confirm Password</Label>
              <PasswordField
                placeholder="••••••••"
                className="rounded-xl border-slate-200 bg-slate-50"
                value={confirmPassword}
                onChange={setConfirmPassword}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              className="mt-6 h-11 w-full rounded-xl bg-primary text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] cursor-pointer"
              disabled={loading}
            >
              {loading ? "Activating…" : "Activate Account"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

export default function OnboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center">Loading...</div>}>
      <OnboardForm />
    </Suspense>
  )
}
