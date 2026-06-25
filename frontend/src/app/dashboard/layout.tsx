"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ReactNode, useState, useEffect } from "react"
import { clearToken } from "@/lib/api"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  FolderKanban,
  CheckCircle,
  Clock,
  PlusCircle,
  LogOut,
  Bell,
  MessageSquare
} from "lucide-react"

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<string>("employee")

  const handleLogout = () => {
    clearToken()
    localStorage.removeItem("userRole")
    router.push("/")
  }

  useEffect(() => {
    const savedRole = localStorage.getItem("userRole")
    if (savedRole) {
      setRole(savedRole)
    }
  }, [])

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Teams", href: "/dashboard/projects", icon: FolderKanban },
    { name: "Pending Reviews", href: "/dashboard/reviews/pending", icon: Clock },
    { name: "Approved", href: "/dashboard/reviews/approved", icon: CheckCircle },
    { name: "Messages", href: "/dashboard/messages", icon: MessageSquare },
  ]

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <aside className="relative z-20 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.ico"
              alt="Sprint Tickets logo"
              className="h-8 w-8 rounded-lg object-contain"
            />
            <span className="font-semibold tracking-tight text-slate-900">Sprint Tickets</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 cursor-pointer ${
                  isActive
                    ? "bg-blue-50 text-primary"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-slate-400"}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="space-y-4 p-4">
          {role !== "ceo" && (
            <Link href="/dashboard/reviews/new">
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] cursor-pointer">
                <PlusCircle className="h-4 w-4" />
                New Review
              </button>
            </Link>
          )}

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-blue-600 text-xs font-bold text-white">
              {role.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium capitalize text-slate-900">{role === 'ceo' ? 'The CEO' : role}</p>
              <p className="truncate text-xs text-slate-500">{role}@company.com</p>
            </div>
            <button onClick={handleLogout} aria-label="Log out" className="text-slate-400 transition-colors hover:text-slate-700 cursor-pointer">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-8 backdrop-blur-md">
          <div className="w-full flex-1">
            <div className="relative max-w-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                aria-label="Search projects and reviews"
                placeholder="Search projects, reviews..."
                className="w-full appearance-none rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button aria-label="Notifications" className="relative p-2 text-slate-400 transition-colors hover:text-slate-700 cursor-pointer">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
            </button>
          </div>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
