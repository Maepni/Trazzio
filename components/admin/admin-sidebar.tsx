"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Building2,
  PackageOpen,
  Users,
  ClipboardList,
  CheckSquare,
  BarChart3,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/companies", label: "Empresas", icon: Building2 },
  { href: "/stock", label: "Mercadería", icon: PackageOpen },
  { href: "/workers", label: "Trabajadores", icon: Users },
  { href: "/assignments", label: "Asignaciones", icon: ClipboardList },
  { href: "/settlements", label: "Rendiciones", icon: CheckSquare },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-64 bg-[#1e3a5f] text-white">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-[#f97316] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg">T</span>
        </div>
        <div>
          <h1 className="font-bold text-lg leading-none">Trazzio</h1>
          <p className="text-blue-300 text-xs mt-0.5">Panel Admin</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-white/15 text-white"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4.5 w-4.5 flex-shrink-0" size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-4">
        <div className="px-3 py-2 rounded-lg bg-white/5 text-xs text-blue-300">
          v1.0.0
        </div>
      </div>
    </aside>
  )
}
