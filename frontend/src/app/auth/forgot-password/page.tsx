"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, Sparkles } from "lucide-react"
import { requestPasswordReset } from "@/lib/api"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset link.")
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    "w-full h-11 px-3.5 rounded-[10px] border border-[#e2e8f0] bg-white text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/12"

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fafc_34%,#eef2ff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_30px_120px_-40px_rgba(15,23,42,0.35)] backdrop-blur-sm lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-100 bg-slate-950 px-10 py-10 text-white lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.16),transparent_32%)]" />
            <div className="relative">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-blue-300" />
                Password recovery
              </div>
              <h1 className="max-w-md text-4xl font-semibold tracking-tight">Recover access without opening a support ticket.</h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">
                Enter your work email and we&apos;ll send a reset link if the account exists.
                The flow is designed to stay quiet for security and fast for employees.
              </p>
            </div>
            <div className="relative rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">What happens next</div>
              <ol className="mt-4 space-y-3 text-sm text-slate-200">
                <li className="flex gap-3"><span className="text-blue-300">01</span>Submit your email address.</li>
                <li className="flex gap-3"><span className="text-blue-300">02</span>Open the reset link from your inbox.</li>
                <li className="flex gap-3"><span className="text-blue-300">03</span>Choose a new password and sign back in.</li>
              </ol>
            </div>
          </div>

          <div className="flex flex-col justify-center px-6 py-10 sm:px-10">
            <Link href="/auth/login" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>

            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary/10 text-primary shadow-[0_10px_30px_-14px_rgba(37,99,235,0.7)]">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight">Forgot password</h2>
                <p className="mt-1 text-sm text-slate-500">We&apos;ll send a reset link if your account exists.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="max-w-md space-y-4">
              {error && (
                <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {sent ? (
                <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                  If an account exists for <strong>{email}</strong>, a reset link has been sent. Check your inbox and spam folder.
                </div>
              ) : (
                <>
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
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full rounded-[10px] bg-primary text-[14.5px] font-semibold text-white shadow-lg shadow-primary/28 transition-all hover:bg-blue-700 disabled:opacity-60"
                  >
                    {loading ? "Sending link..." : "Send reset link"}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
