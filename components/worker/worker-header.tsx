"use client"

import { signOut, useSession } from "next-auth/react"
import { LogOut } from "lucide-react"

export function WorkerHeader() {
  const { data: session } = useSession()

  return (
    <header className="bg-[#1e3a5f] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#f97316] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">T</span>
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight">Trazzio</h1>
          {session?.user?.workerName && (
            <p className="text-blue-300 text-xs leading-tight">{session.user.workerName}</p>
          )}
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-1.5 text-blue-300 hover:text-white transition-colors text-xs font-medium py-1.5 px-2 rounded-lg hover:bg-white/10"
        title="Cerrar sesión"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </header>
  )
}
