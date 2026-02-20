"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatUnitsToBoxes, formatDate } from "@/lib/utils"
import { Package, CheckCircle2, Clock, ArrowRight } from "lucide-react"
import Link from "next/link"

interface Props {
  assignments: any[]
  workerName: string
}

export function WorkerHome({ assignments, workerName }: Props) {
  const pending = assignments.filter((a) => a.status === "PENDING")
  const settled = assignments.filter((a) => a.status === "SETTLED")
  const totalPending = pending.reduce((sum, a) => sum + a.quantityAssigned, 0)
  const totalEarned = settled.reduce((sum, a) => sum + Number(a.settlement?.amountDue ?? 0), 0)

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <div>
        <h2 className="text-xl font-bold text-[#1e3a5f]">¡Hola, {workerName}!</h2>
        <p className="text-gray-500 text-sm">{formatDate(new Date())}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm bg-[#1e3a5f] text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-300" />
              <span className="text-xs text-blue-300">Pendientes</span>
            </div>
            <p className="text-2xl font-bold">{pending.length}</p>
            <p className="text-xs text-blue-300 mt-0.5">{totalPending} unidades</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-200" />
              <span className="text-xs text-green-200">Rendido hoy</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalEarned)}</p>
            <p className="text-xs text-green-200 mt-0.5">{settled.length} productos</p>
          </CardContent>
        </Card>
      </div>

      {pending.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Por rendir hoy</h3>
            <Link href="/settle">
              <Button size="sm" className="h-8 bg-[#f97316] hover:bg-orange-600 text-white gap-1 text-xs">
                Rendir ahora <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {pending.map((a) => (
              <Card key={a.id} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Package className="h-5 w-5 text-[#f97316]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{a.product.name}</p>
                    <p className="text-xs text-gray-400">{a.product.company.name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900">
                      {formatUnitsToBoxes(a.quantityAssigned, a.product.unitPerBox)}
                    </p>
                    <p className="text-xs text-gray-400">{formatCurrency(a.product.salePrice)} c/u</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {settled.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Rendidos hoy</h3>
          <div className="space-y-2">
            {settled.map((a) => (
              <Card key={a.id} className="border-0 shadow-sm opacity-80">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700 truncate">{a.product.name}</p>
                    <p className="text-xs text-gray-400">
                      {a.settlement?.totalSold ?? 0} vendidos · {a.settlement?.totalMerma ?? 0} merma
                    </p>
                  </div>
                  <p className="font-semibold text-green-600 flex-shrink-0">
                    {formatCurrency(a.settlement?.amountDue)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {assignments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Package className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">Sin productos asignados hoy</p>
          <p className="text-xs mt-1 text-center">El administrador asignará productos próximamente</p>
        </div>
      )}
    </div>
  )
}
