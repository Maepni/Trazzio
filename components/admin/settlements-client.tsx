"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { formatCurrency, formatDateTime, formatDate } from "@/lib/utils"
import {
  CheckCircle2, XCircle, Filter, Calendar, User,
  ChevronRight, Package, TrendingUp, AlertTriangle,
  ClipboardList, Pencil, X
} from "lucide-react"

function WorkerAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  return (
    <div className="w-10 h-10 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
      <span className="text-white text-sm font-bold">{initials}</span>
    </div>
  )
}

function StatusBadge({ difference }: { difference: number }) {
  const ok = Math.abs(difference) < 0.01
  return ok ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
      <CheckCircle2 className="h-3.5 w-3.5" /> Cuadrado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
      <XCircle className="h-3.5 w-3.5" /> {formatCurrency(Math.abs(difference))} diff.
    </span>
  )
}

export function SettlementsClient({
  initialSettlements,
  workers,
}: {
  initialSettlements: any[]
  workers: any[]
}) {
  const queryClient = useQueryClient()
  const today = new Date().toISOString().split("T")[0]

  const [filters, setFilters] = useState({ from: today, to: today, workerId: "" })
  const [selected, setSelected] = useState<any>(null)
  const [adjustPaid, setAdjustPaid] = useState("")
  const [adjustNote, setAdjustNote] = useState("")
  const [adjusting, setAdjusting] = useState(false)

  const params = new URLSearchParams()
  if (filters.from) params.set("from", filters.from)
  if (filters.to) params.set("to", filters.to)
  if (filters.workerId) params.set("workerId", filters.workerId)

  const { data: settlements = initialSettlements } = useQuery({
    queryKey: ["settlements", filters],
    queryFn: async () => {
      const r = await fetch(`/api/settlements?${params.toString()}`)
      return r.json()
    },
    initialData: filters.from === today && filters.to === today && !filters.workerId ? initialSettlements : undefined,
    refetchInterval: 30000,
  })

  const adjustMutation = useMutation({
    mutationFn: async ({ id, amountPaid, adjustmentNote }: { id: string; amountPaid: number; adjustmentNote: string }) => {
      const r = await fetch(`/api/settlements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid, adjustmentNote }),
      })
      if (!r.ok) throw new Error("Error al ajustar")
      return r.json()
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["settlements"] })
      setSelected(updated)
      setAdjusting(false)
      setAdjustPaid("")
      setAdjustNote("")
      toast.success("Monto ajustado correctamente")
    },
    onError: () => toast.error("Error al ajustar el monto"),
  })

  const stats = useMemo(() => ({
    totalCobrado: settlements.reduce((s: number, x: any) => s + Number(x.amountDue), 0),
    totalMerma: settlements.reduce((s: number, x: any) => s + x.totalMerma, 0),
    totalDiff: settlements.reduce((s: number, x: any) => s + Number(x.difference), 0),
    conDiff: settlements.filter((x: any) => Math.abs(Number(x.difference)) >= 0.01).length,
  }), [settlements])

  const setToday = () => setFilters(f => ({ ...f, from: today, to: today }))
  const setThisWeek = () => {
    const d = new Date()
    const mon = new Date(d)
    mon.setDate(d.getDate() - d.getDay() + 1)
    setFilters(f => ({ ...f, from: mon.toISOString().split("T")[0], to: today }))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Rendiciones</h1>
          <p className="text-gray-500 text-sm mt-0.5">{settlements.length} registro{settlements.length !== 1 ? "s" : ""} encontrado{settlements.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={setToday}>Hoy</Button>
          <Button size="sm" variant="outline" className="text-xs h-8" onClick={setThisWeek}>Esta semana</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Desde
            </label>
            <Input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Hasta
            </label>
            <Input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Cobrado", value: formatCurrency(stats.totalCobrado), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Merma", value: `${stats.totalMerma} und.`, icon: Package, color: "text-orange-500", bg: "bg-orange-50" },
          { label: "Con Diferencia", value: `${stats.conDiff} rendic.`, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50" },
          { label: "Rendiciones", value: settlements.length, icon: ClipboardList, color: "text-[#1e3a5f]", bg: "bg-blue-50" },
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

      {/* Cards */}
      {settlements.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-16 text-center shadow-sm">
          <ClipboardList className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Sin rendiciones en el período seleccionado</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {settlements.map((s: any) => {
            const diff = Number(s.difference)
            const ok = Math.abs(diff) < 0.01
            return (
              <button
                key={s.id}
                onClick={() => { setSelected(s); setAdjusting(false); setAdjustPaid(""); setAdjustNote("") }}
                className={`bg-white text-left border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group ${ok ? "border-gray-100 hover:border-emerald-200" : "border-red-100 hover:border-red-300"}`}
              >
                {/* Top */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <WorkerAvatar name={s.assignment.worker.name} />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{s.assignment.worker.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(s.settledAt)}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-1 flex-shrink-0" />
                </div>

                {/* Product */}
                <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3">
                  <p className="text-xs font-medium text-gray-700 truncate">{s.assignment.product.name}</p>
                  <p className="text-xs text-gray-400">{s.assignment.product.company.name}</p>
                </div>

                {/* Amounts */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">A cobrar</p>
                    <p className="font-bold text-gray-900">{formatCurrency(s.amountDue)}</p>
                  </div>
                  <StatusBadge difference={diff} />
                </div>

                {/* Merma indicator */}
                {s.totalMerma > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <span className="text-xs text-orange-600 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {s.totalMerma} und. de merma
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setAdjusting(false) } }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-center gap-3">
                  <WorkerAvatar name={selected.assignment.worker.name} />
                  <div>
                    <SheetTitle className="text-lg">{selected.assignment.worker.name}</SheetTitle>
                    <p className="text-sm text-gray-400">{formatDateTime(selected.settledAt)}</p>
                  </div>
                </div>
              </SheetHeader>

              {/* Status banner */}
              {Math.abs(Number(selected.difference)) < 0.01 ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Rendición cuadrada</p>
                    <p className="text-xs text-emerald-600">El monto pagado coincide con lo vendido</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Diferencia de {formatCurrency(Math.abs(Number(selected.difference)))}</p>
                    <p className="text-xs text-red-600">{Number(selected.difference) > 0 ? "Falta por pagar" : "Pagó de más"}</p>
                  </div>
                </div>
              )}

              {/* Breakdown table */}
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Detalle del producto</h3>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs">Concepto</TableHead>
                        <TableHead className="text-right text-xs">Und.</TableHead>
                        <TableHead className="text-right text-xs">Precio</TableHead>
                        <TableHead className="text-right text-xs">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-sm">
                          <div>
                            <p className="font-medium">{selected.assignment.product.name}</p>
                            <p className="text-xs text-gray-400">{selected.assignment.product.company.name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">{selected.assignment.quantityAssigned} asig.</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(selected.assignment.product.salePrice)}</TableCell>
                        <TableCell className="text-right text-sm text-gray-400">—</TableCell>
                      </TableRow>
                      <TableRow className="bg-gray-50/50">
                        <TableCell className="text-sm text-gray-500">↳ Sobrante</TableCell>
                        <TableCell className="text-right text-sm text-gray-500">−{selected.assignment.quantityReturned ?? 0}</TableCell>
                        <TableCell className="text-right text-sm text-gray-400">—</TableCell>
                        <TableCell className="text-right text-sm text-gray-400">—</TableCell>
                      </TableRow>
                      {selected.totalMerma > 0 && (
                        <TableRow className="bg-orange-50/30">
                          <TableCell className="text-sm text-orange-600">↳ Merma</TableCell>
                          <TableCell className="text-right text-sm text-orange-600">−{selected.totalMerma}</TableCell>
                          <TableCell className="text-right text-sm text-gray-400">—</TableCell>
                          <TableCell className="text-right text-sm text-gray-400">—</TableCell>
                        </TableRow>
                      )}
                      <TableRow className="font-semibold">
                        <TableCell className="text-sm">Vendido</TableCell>
                        <TableCell className="text-right text-sm">{selected.totalSold} und.</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(selected.assignment.product.salePrice)}</TableCell>
                        <TableCell className="text-right text-sm font-bold text-[#1e3a5f]">{formatCurrency(selected.amountDue)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Merma detail */}
              {selected.assignment.mermaItems?.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Merma registrada</h3>
                  <div className="space-y-2">
                    {selected.assignment.mermaItems.map((m: any) => (
                      <div key={m.id} className="flex items-start gap-3 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{m.quantity} unidades</p>
                          {m.reason && <p className="text-xs text-gray-500 mt-0.5">{m.reason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment summary */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">A cobrar</span>
                  <span className="font-semibold">{formatCurrency(selected.amountDue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pagó</span>
                  <span className="font-semibold">{formatCurrency(selected.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                  <span className="font-semibold">Diferencia</span>
                  <span className={`font-bold ${Math.abs(Number(selected.difference)) < 0.01 ? "text-emerald-600" : "text-red-600"}`}>
                    {Math.abs(Number(selected.difference)) < 0.01 ? "S/ 0.00 ✓" : formatCurrency(selected.difference)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {selected.notes && (
                <div className="mb-5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Notas</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}

              {/* Admin adjustment */}
              {!adjusting ? (
                <Button
                  variant="outline"
                  className="w-full border-dashed text-gray-500 hover:text-[#1e3a5f] hover:border-[#1e3a5f]"
                  onClick={() => { setAdjusting(true); setAdjustPaid(String(selected.amountPaid)) }}
                >
                  <Pencil className="h-4 w-4 mr-2" /> Ajustar monto pagado
                </Button>
              ) : (
                <div className="border border-[#1e3a5f]/20 rounded-xl p-4 space-y-3 bg-blue-50/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#1e3a5f]">Ajustar monto pagado</p>
                    <button onClick={() => setAdjusting(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nuevo monto pagado (S/)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={adjustPaid}
                      onChange={e => setAdjustPaid(e.target.value)}
                      className="h-10"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nota de ajuste (opcional)</label>
                    <Textarea
                      value={adjustNote}
                      onChange={e => setAdjustNote(e.target.value)}
                      placeholder="Motivo del ajuste..."
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                  <Button
                    className="w-full bg-[#1e3a5f] hover:bg-[#162d4a] text-white"
                    disabled={!adjustPaid || adjustMutation.isPending}
                    onClick={() => adjustMutation.mutate({
                      id: selected.id,
                      amountPaid: parseFloat(adjustPaid),
                      adjustmentNote: adjustNote,
                    })}
                  >
                    {adjustMutation.isPending ? "Guardando..." : "Guardar ajuste"}
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
