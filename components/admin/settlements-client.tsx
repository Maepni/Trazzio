"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils"
import { CompanyBadge } from "@/components/shared/company-badge"
import {
  Filter, Calendar, User, ChevronRight,
  TrendingUp, AlertTriangle, ClipboardList, Package
} from "lucide-react"

function WorkerAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  return (
    <div className="w-10 h-10 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
      <span className="text-white text-sm font-bold">{initials}</span>
    </div>
  )
}

export function SettlementsClient({
  initialAssignments,
  workers,
}: {
  initialAssignments: any[]
  workers: any[]
}) {
  const [filters, setFilters] = useState({ from: "", to: "", workerId: "" })
  const [selected, setSelected] = useState<any | null>(null)

  const params = new URLSearchParams()
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)
  if (filters.workerId) params.set("workerId", filters.workerId)

  const { data: assignments = initialAssignments } = useQuery({
    queryKey: ["closed-assignments", filters],
    queryFn: async () => {
      const r = await fetch(`/api/settlements?${params.toString()}`)
      return r.json()
    },
    initialData: !filters.from && !filters.to && !filters.workerId ? initialAssignments : undefined,
    refetchInterval: 60000,
  })

  // Agrupar por trabajador
  const workerGroups = useMemo(() => {
    const map = new Map<string, any>()
    for (const a of assignments) {
      if (!map.has(a.workerId)) {
        map.set(a.workerId, {
          worker: a.worker,
          assignments: [],
          totalDue: 0,
          totalPaid: 0,
          pendingDebt: 0,
          totalMerma: 0,
        })
      }
      const g = map.get(a.workerId)!
      g.assignments.push(a)
      g.totalDue += a.totalDue ?? 0
      g.totalPaid += a.totalPaid ?? 0
      g.pendingDebt += a.pendingDebt ?? 0
      g.totalMerma += a.totalMerma ?? 0
    }
    // Trabajadores con deuda primero
    return Array.from(map.values()).sort((a, b) => b.pendingDebt - a.pendingDebt)
  }, [assignments])

  const stats = useMemo(() => ({
    totalCobrado: assignments.reduce((s: number, a: any) => s + (a.totalDue ?? 0), 0),
    totalMerma: assignments.reduce((s: number, a: any) => s + (a.totalMerma ?? 0), 0),
    conDeuda: workerGroups.filter(g => g.pendingDebt > 0.01).length,
  }), [assignments, workerGroups])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Historial</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {workerGroups.length} trabajador(es) · {assignments.length} asignación(es) cerrada(s)
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Desde
            </label>
            <Input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Hasta
            </label>
            <Input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              <User className="h-3 w-3" /> Trabajador
            </label>
            <Select value={filters.workerId || "all"} onValueChange={v => setFilters(f => ({ ...f, workerId: v === "all" ? "" : v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los trabajadores</SelectItem>
                {workers.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Cobrado", value: formatCurrency(stats.totalCobrado), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Merma", value: `${stats.totalMerma} und.`, icon: Package, color: "text-orange-500", bg: "bg-orange-50" },
          { label: "Con Deuda", value: `${stats.conDeuda} trabajador(es)`, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</span>
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Lista por trabajador */}
      {workerGroups.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-16 text-center shadow-sm">
          <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Sin asignaciones cerradas en el período</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workerGroups.map((group) => {
            const hasDebt = group.pendingDebt > 0.01
            return (
              <button
                key={group.worker.id}
                onClick={() => setSelected(group)}
                className={`bg-white text-left border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group ${hasDebt ? "border-orange-100 hover:border-orange-300" : "border-gray-100 hover:border-green-200"}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <WorkerAvatar name={group.worker.name} />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{group.worker.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{group.assignments.length} asignación(es) cerrada(s)</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-1 flex-shrink-0" />
                </div>

                <div className="flex items-end justify-between pt-2 border-t border-gray-50">
                  <div>
                    <p className="text-xs text-gray-400">Total vendido</p>
                    <p className="font-bold text-gray-900">{formatCurrency(group.totalDue)}</p>
                  </div>
                  {hasDebt ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> {formatCurrency(group.pendingDebt)} pend.
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                      Cuadrado
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Sheet detalle del trabajador */}
      <Sheet open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null) }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="mb-5">
                <div className="flex items-center gap-3">
                  <WorkerAvatar name={selected.worker.name} />
                  <div>
                    <SheetTitle className="text-lg">{selected.worker.name}</SheetTitle>
                    <p className="text-sm text-gray-400">{selected.assignments.length} asignación(es) cerrada(s)</p>
                  </div>
                </div>
              </SheetHeader>

              {/* Resumen del trabajador */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs mb-5">
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-green-500 font-medium">Total cobrado</p>
                  <p className="font-bold text-green-800">{formatCurrency(selected.totalDue)}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <p className="text-blue-500 font-medium">Total pagado</p>
                  <p className="font-bold text-blue-800">{formatCurrency(selected.totalPaid)}</p>
                </div>
                <div className={`${selected.pendingDebt > 0.01 ? "bg-orange-50" : "bg-gray-50"} rounded-lg p-2`}>
                  <p className={`${selected.pendingDebt > 0.01 ? "text-orange-500" : "text-gray-500"} font-medium`}>Pendiente</p>
                  <p className={`font-bold ${selected.pendingDebt > 0.01 ? "text-orange-800" : "text-gray-800"}`}>
                    {formatCurrency(selected.pendingDebt)}
                  </p>
                </div>
              </div>

              {/* Historial de asignaciones del trabajador */}
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Historial de asignaciones</h3>
              <div className="space-y-3">
                {selected.assignments.map((a: any) => (
                  <div key={a.id} className="border border-gray-100 rounded-xl overflow-hidden">
                    {/* Header del producto */}
                    <div className="px-4 py-2.5 bg-gray-50 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{a.product.name}</p>
                        <div className="mt-0.5">
                          <CompanyBadge companyName={a.product.company.name} colorKey={a.product.company.id} />
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-400 flex-shrink-0 ml-2">
                        <p>Desde: {formatDate(new Date(a.startDate))}</p>
                        <p>{a.quantityAssigned}u asignadas</p>
                      </div>
                    </div>

                    {/* Totales rápidos */}
                    <div className="px-4 py-2 flex gap-3 text-xs border-b border-gray-100">
                      <span className="text-green-700 font-medium">Vendido: {a.totalSold ?? 0}u</span>
                      {(a.totalMerma ?? 0) > 0 && (
                        <span className="text-red-600">Merma: {a.totalMerma}u</span>
                      )}
                      <span className="text-gray-500 ml-auto">Cobrar: {formatCurrency(a.totalDue ?? 0)}</span>
                    </div>

                    {/* Tabla de registros diarios */}
                    {a.dailySales?.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50/50">
                            <TableHead className="text-xs py-2">Fecha</TableHead>
                            <TableHead className="text-right text-xs py-2">Vend.</TableHead>
                            <TableHead className="text-right text-xs py-2">Merma</TableHead>
                            <TableHead className="text-right text-xs py-2">Pagó</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {a.dailySales.map((d: any) => (
                            <TableRow key={d.id}>
                              <TableCell className="text-xs text-gray-600 py-1.5">{formatDate(new Date(d.date))}</TableCell>
                              <TableCell className="text-right text-xs text-green-700 font-medium py-1.5">{d.quantitySold}u</TableCell>
                              <TableCell className="text-right text-xs text-red-500 py-1.5">{d.quantityMerma}u</TableCell>
                              <TableCell className="text-right text-xs font-medium py-1.5">{formatCurrency(Number(d.amountPaid))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
