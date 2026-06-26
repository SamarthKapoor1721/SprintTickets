"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { login } from "@/lib/api"

// Seeded demo accounts (see backend/prisma/seed.ts). All share this password.
const DEMO_ACCOUNTS: Record<string, string> = {
  ceo: "ceo@erh.dev",
  manager: "manager@erh.dev",
  employee: "employee@erh.dev",
}
const DEMO_PASSWORD = "password123"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleMockLogin = async (role: string) => {
    setError(null)
    setLoading(role)
    try {
      await login(DEMO_ACCOUNTS[role], DEMO_PASSWORD)
      localStorage.setItem("userRole", role)
      router.push("/dashboard")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed. Is the backend running?")
      setLoading(null)
    }
  }

  const roles = [
    { id: "ceo", label: "CEO", blurb: "System admin access to review and approve all projects.", cta: "Enter as the CEO" },
    { id: "manager", label: "Manager", blurb: "Manage team projects and track CEO approvals.", cta: "Enter as Project Manager" },
    { id: "employee", label: "Employee", blurb: "Submit project deliverables for executive review.", cta: "Enter as Employee" },
  ]

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

          <Tabs defaultValue="ceo" className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {roles.map((r) => (
                <TabsTrigger
                  key={r.id}
                  value={r.id}
                  className="rounded-lg text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                >
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {roles.map((r) => (
              <TabsContent key={r.id} value={r.id} className="space-y-5 outline-none">
                <p className="flex h-10 items-center justify-center text-center text-sm text-slate-500">
                  {r.blurb}
                </p>
                <Button
                  className="h-11 w-full rounded-xl bg-primary text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.99] cursor-pointer"
                  onClick={() => handleMockLogin(r.id)}
                  disabled={loading !== null}
                >
                  {loading === r.id ? "Signing in…" : r.cta}
                </Button>
              </TabsContent>
            ))}
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                SSO Disabled
              </span>
            </div>
          </div>

          <div className="space-y-4 opacity-60 select-none pointer-events-none">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500">Work Email</Label>
              <Input type="email" placeholder="name@company.com" className="rounded-xl border-slate-200 bg-slate-50" disabled />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500">Password</Label>
              <Input type="password" placeholder="••••••••" className="rounded-xl border-slate-200 bg-slate-50" disabled />
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Demo accounts use password <span className="font-medium text-slate-500">password123</span>
        </p>
      </motion.div>
    </div>
  )
}
