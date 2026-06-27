"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ReactNode, useState } from "react"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  FolderKanban,
  CheckCircle,
  Clock,
  Plus,
  LogOut,
  Bell,
  MessageSquare,
  ClipboardList,
  FileText,
  Users,
  Search,
  PanelLeftClose,
  PanelLeft,
  Menu,
} from "lucide-react"
import { AuthProvider, useAuth } from "@/lib/auth-context"

interface DashboardLayoutProps {
  children: ReactNode
}

const PAGE_META: { match: (p: string) => boolean; title: string; sub: string }[] = [
  { match: (p) => p === "/dashboard", title: "Dashboard", sub: "Your workspace at a glance" },
  { match: (p) => p.startsWith("/dashboard/users"), title: "Users", sub: "People in your organization" },
  { match: (p) => p.startsWith("/dashboard/projects"), title: "Teams", sub: "Teams and their reviews" },
  { match: (p) => p.startsWith("/dashboard/tasks"), title: "Tasks", sub: "Track team tasks" },
  { match: (p) => p.startsWith("/dashboard/reports"), title: "Reports", sub: "Submitted reports" },
  { match: (p) => p.startsWith("/dashboard/reviews/new"), title: "New review", sub: "Submit work for review" },
  { match: (p) => p.startsWith("/dashboard/reviews"), title: "Reviews", sub: "Review requests across the company" },
  { match: (p) => p.startsWith("/dashboard/messages"), title: "Direct messages", sub: "Private 1:1 conversations" },
]

function DashboardContent({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)   // desktop collapse
  const [mobileOpen, setMobileOpen] = useState(false) // mobile drawer

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Loading...</div>
  }

  const role = user.role
  const isReviewer = role === "ceo" || role === "super_admin"
  const meta = PAGE_META.find((m) => m.match(pathname)) ?? PAGE_META[0]
  const initials = (user.full_name ?? user.email ?? "?").slice(0, 1).toUpperCase()

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ...(role !== "employee" ? [{ name: "Users", href: "/dashboard/users", icon: Users }] : []),
    { name: "Teams", href: "/dashboard/projects", icon: FolderKanban },
    { name: "Tasks", href: "/dashboard/tasks", icon: ClipboardList },
    { name: "Reports", href: "/dashboard/reports", icon: FileText },
    { name: "Pending Reviews", href: "/dashboard/reviews/pending", icon: Clock },
    { name: "Approved", href: "/dashboard/reviews/approved", icon: CheckCircle },
    { name: "Direct messages", href: "/dashboard/messages", icon: MessageSquare },
  ]

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      {/* Logo + collapse button */}
      <div className="flex items-center justify-between px-2 pb-[18px] pt-1">
        <Link href="/dashboard" onClick={onNav} className="flex items-center gap-2.5 min-w-0">
          <img src="/logo.ico" alt="Sprint Tickets logo" className="h-[30px] w-[30px] flex-shrink-0 rounded-[9px] object-contain" />
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold tracking-tight text-slate-900">Sprint Tickets</span>
          )}
        </Link>
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] text-slate-400 transition-colors hover:bg-[#f4f7fb] hover:text-slate-700 cursor-pointer"
        >
          {collapsed
            ? <PanelLeft className="h-4 w-4" strokeWidth={1.8} />
            : <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} />
          }
        </button>
      </div>

      {/* New review button — hidden for CEO / admin (they review, not submit) */}
      {!isReviewer && (
        <Link href="/dashboard/reviews/new" onClick={onNav}>
          <button className={`mb-4 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[13.5px] font-semibold text-white shadow-lg shadow-primary/24 transition-colors hover:bg-blue-700 cursor-pointer ${collapsed ? "px-0" : ""}`}>
            <Plus className="h-[15px] w-[15px] flex-shrink-0" strokeWidth={2.4} />
            {!collapsed && "New review"}
          </button>
        </Link>
      )}

      {!collapsed && (
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Workspace
        </div>
      )}

      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard")
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNav}
              title={collapsed ? item.name : undefined}
              className={`flex h-[38px] items-center gap-[11px] rounded-[9px] px-2.5 text-[13.5px] font-medium transition-colors cursor-pointer ${
                collapsed ? "justify-center px-0" : ""
              } ${isActive ? "bg-[#eef4ff] text-primary" : "text-slate-600 hover:bg-[#f4f7fb] hover:text-slate-900"}`}
            >
              <item.icon className={`h-[17px] w-[17px] flex-shrink-0 ${isActive ? "text-primary" : "text-slate-400"}`} strokeWidth={1.9} />
              {!collapsed && item.name}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className={`mt-auto flex items-center border-t border-[#eef2f7] pt-3 ${collapsed ? "flex-col gap-2" : "gap-2.5"}`}>
        <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-primary text-[13px] font-semibold text-white">
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold capitalize text-slate-800">{role.replace("_", " ")}</div>
            <div className="truncate text-[11.5px] text-slate-400">{user.email}</div>
          </div>
        )}
        <button
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#f4f7fb] hover:text-red-600 cursor-pointer"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.9} />
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f5f7fa]">

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={`relative z-20 hidden flex-shrink-0 flex-col border-r border-[#eef2f7] bg-white py-[18px] md:flex transition-all duration-200 ${
          collapsed ? "w-[64px] px-2" : "w-[248px] px-3.5"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#eef2f7] bg-white px-3.5 py-[18px] transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent onNav={() => setMobileOpen(false)} />
      </aside>

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-[#eef2f7] bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#eef2f7] text-slate-500 transition-colors hover:bg-[#f4f7fb] md:hidden cursor-pointer"
            >
              <Menu className="h-4 w-4" strokeWidth={1.9} />
            </button>
            <div>
              <div className="text-base font-semibold tracking-tight text-slate-900">{meta.title}</div>
              <div className="mt-px text-[12.5px] text-slate-400">{meta.sub}</div>
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="hidden items-center gap-2 rounded-[10px] border border-[#eef2f7] bg-[#f5f7fa] px-3 sm:flex" style={{ height: 38, width: 230 }}>
              <Search className="h-[15px] w-[15px] text-slate-400" strokeWidth={2} />
              <input
                aria-label="Search"
                placeholder="Search reviews, teams…"
                className="w-full border-none bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
            <button
              aria-label="Notifications"
              className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-[#eef2f7] bg-white text-slate-600 transition-colors hover:bg-[#f8fafc] cursor-pointer"
            >
              <Bell className="h-[17px] w-[17px]" strokeWidth={1.9} />
              <span className="absolute right-[9px] top-2 h-[7px] w-[7px] rounded-full border-[1.5px] border-white bg-red-600" />
            </button>
          </div>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-[26px]"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  )
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  )
}
