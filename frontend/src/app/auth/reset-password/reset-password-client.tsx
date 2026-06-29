"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Lock, Sparkles } from "lucide-react"
import { resetPassword } from "@/lib/api"
import { PasswordField } from "@/components/password-field"

export default function ResetPasswordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const tokenMissing = !token

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError("Missing reset token.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => router.push("/auth/login"), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.")
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    "w-full h-11 px-3.5 rounded-[10px] border border-[#e2e8f0] bg-white text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/12"

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ecfeff_0%,#f8fafc_34%,#eff6ff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_30px_120px_-40px_rgba(15,23,42,0.35)] backdrop-blur-sm lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative order-2 flex flex-col justify-center px-6 py-10 sm:px-10 lg:order-1">
            <Link href="/auth/login" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
              Back to sign in
            </Link>

            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary/10 text-primary shadow-[0_10px_30px_-14px_rgba(37,99,235,0.7)]">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">Set a new password</h2>
                <p className="mt-1 text-sm text-slate-500">Choose a secure password for your Sprint Tickets account.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="max-w-md space-y-4">
              {(error || tokenMissing) && (
                <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error ?? "Missing reset token."}
                </div>
              )}
              {done ? (
                <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                  <CheckCircle2 className="mr-2 inline h-4 w-4" />
                  Password updated. Redirecting to sign in...
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-slate-600">New password</label>
                    <PasswordField
                      placeholder="At least 8 characters"
                      className={inputCls}
                      value={password}
                      onChange={setPassword}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-slate-600">Confirm password</label>
                    <PasswordField
                      placeholder="Repeat password"
                      className={inputCls}
                      value={confirm}
                      onChange={setConfirm}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !token}
                    className="h-11 w-full rounded-[10px] bg-primary text-[14.5px] font-semibold text-white shadow-lg shadow-primary/28 transition-all hover:bg-blue-700 disabled:opacity-60"
                  >
                    {loading ? "Updating..." : "Update password"}
                  </button>
                </>
              )}
            </form>
          </div>

          <div className="relative order-1 hidden overflow-hidden border-l border-slate-100 bg-slate-950 px-10 py-10 text-white lg:flex lg:order-2">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.24),transparent_36%)]" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                  Secure reset
                </div>
                <h1 className="max-w-md text-4xl font-semibold tracking-tight">A clean handoff from recovery to sign in.</h1>
                <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">
                  Once the password is updated, the old token is invalidated immediately.
                  That keeps the reset flow simple and safe for everyone using the workspace.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Good practice</div>
                <p className="mt-3 text-sm text-slate-200">
                  Use a unique password that you do not reuse in other internal systems.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
