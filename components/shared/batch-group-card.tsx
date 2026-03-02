"use client"

import { useState } from "react"
import { Package, ChevronDown, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"

interface BatchGroupCardProps {
  label: string
  date: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
  extra?: React.ReactNode
}

export function BatchGroupCard({
  label,
  date,
  count,
  children,
  defaultOpen = true,
  extra,
}: BatchGroupCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b hover:bg-gray-100 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        }
        <Package className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-400">{date}</span>
        {extra && <span className="ml-1">{extra}</span>}
        <span className="ml-auto text-xs text-gray-400">{count} producto(s)</span>
      </button>
      {open && children}
    </Card>
  )
}
