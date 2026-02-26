import { Package } from "lucide-react"
import { Card } from "@/components/ui/card"

interface BatchGroupCardProps {
  label: string
  date: string
  count: number
  children: React.ReactNode
}

export function BatchGroupCard({ label, date, count, children }: BatchGroupCardProps) {
  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b">
        <Package className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-400">{date}</span>
        <span className="ml-auto text-xs text-gray-400">{count} producto(s)</span>
      </div>
      {children}
    </Card>
  )
}
