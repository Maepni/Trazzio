"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, ClipboardCheck } from "lucide-react"

const navItems = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/settle", label: "Rendir", icon: ClipboardCheck },
]

export function WorkerBottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 safe-area-bottom">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-3 gap-1 text-xs font-medium transition-colors",
              active ? "text-[#f97316]" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
