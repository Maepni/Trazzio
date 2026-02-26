"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatUnitsToBoxes, formatDate } from "@/lib/utils"
import { Package, ArrowRight, TrendingUp, AlertCircle } from "lucide-react"
import Link from "next/link"

interface Props {
  assignments: any[]
  workerName: string
}

export function WorkerHome({ assignments, workerName }: Props) {
  const totalPendingDebt = assignments.reduce((sum, a) => sum + (a.pendingDebt ?? 0), 0)

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <div>
        <h2 className="text-xl font-bold text-[#1e3a5f]">¡Hola, {workerName}!</h2>
        <p className="text-gray-500 text-sm">{formatDate(new Date())}</p>
      </div>

      {/* Resumen de deuda total */}
      {assignments.length > 0 && (
        <div className={`rounded-xl p-4 flex items-center justify-between ${
          totalPendingDebt > 0
            ? "bg-orange-50 border border-orange-200"
            : "bg-green-50 border border-green-200"
        }`}>
          <div>
            <p className={`text-xs font-medium uppercase tracking-wide ${
              totalPendingDebt > 0 ? "text-orange-600" : "text-green-600"
            }`}>
              Deuda pendiente total
            </p>
            <p className={`text-2xl font-bold mt-0.5 ${
              totalPendingDebt > 0 ? "text-orange-700" : "text-green-700"
            }`}>
              {formatCurrency(totalPendingDebt)}
            </p>
          </div>
          <TrendingUp className={`h-8 w-8 ${totalPendingDebt > 0 ? "text-orange-400" : "text-green-400"}`} />
        </div>
      )}

      {/* Botón registrar */}
      {assignments.length > 0 && (
        <Link href="/settle">
          <Button className="w-full h-12 bg-[#f97316] hover:bg-orange-600 text-white font-semibold text-base gap-2">
            Registrar ventas del día <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}

      {/* Lista de productos activos */}
      {assignments.length > 0 ? (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">Mis productos activos</h3>
          <div className="space-y-3">
            {assignments.map((a) => (
              <Card key={a.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-[#f97316]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{a.product.name}</p>
                      <p className="text-xs text-gray-400">{a.product.company.name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">precio</p>
                      <p className="text-sm font-semibold text-gray-700">
                        {formatCurrency(Number(a.product.salePrice))}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-xs text-blue-500 font-medium">Asignado</p>
                      <p className="text-sm font-bold text-blue-800">
                        {formatUnitsToBoxes(a.quantityAssigned, a.product.unitPerBox)}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="text-xs text-green-500 font-medium">Vendido</p>
                      <p className="text-sm font-bold text-green-800">{a.totalSold}u</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2">
                      <p className="text-xs text-red-500 font-medium">Merma</p>
                      <p className="text-sm font-bold text-red-800">{a.totalMerma}u</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-xs text-gray-500 font-medium">Restante</p>
                      <p className="text-sm font-bold text-gray-800">{a.remaining}u</p>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-between items-center text-sm border-t border-gray-100 pt-2.5">
                    <div className="space-y-0.5">
                      <div className="flex gap-2">
                        <span className="text-gray-400">A cobrar:</span>
                        <span className="font-semibold text-gray-700">{formatCurrency(a.totalDue)}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400">Pagado:</span>
                        <span className="font-semibold text-gray-700">{formatCurrency(a.totalPaid)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Pendiente</p>
                      <p className={`text-base font-bold ${a.pendingDebt > 0 ? "text-orange-600" : "text-green-600"}`}>
                        {formatCurrency(a.pendingDebt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <AlertCircle className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">Sin productos asignados</p>
          <p className="text-xs mt-1 text-center">El administrador asignará productos próximamente</p>
        </div>
      )}
    </div>
  )
}
