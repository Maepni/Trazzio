"use client"

import { signOut, useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, User, Menu } from "lucide-react"
import { MobileNav } from "@/components/admin/mobile-nav"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/companies": "Empresas y Productos",
  "/stock": "Recepción de Mercadería",
  "/workers": "Trabajadores",
  "/assignments": "Asignaciones del Día",
  "/settlements": "Rendiciones",
  "/reports": "Reportes",
}

export function AdminHeader() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const title = pageTitles[pathname] ?? "Trazzio"

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <MobileNav />
        <h2 className="font-semibold text-[#1e3a5f] text-base md:text-lg">{title}</h2>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 h-9 px-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-[#1e3a5f] text-white text-xs">
                A
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:block text-sm text-gray-700">
              {session?.user?.email?.split("@")[0]}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="text-gray-500 text-xs" disabled>
            {session?.user?.email}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-red-600 cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
