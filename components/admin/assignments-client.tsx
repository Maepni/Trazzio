"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, ClipboardList, User, History, XCircle, AlertTriangle, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react"
import { formatCurrency, formatUnitsToBoxes, formatDate, formatDateTime } from "@/lib/utils"
import { getProductLabels } from "@/lib/product-types"
import { CompanyBadge } from "@/components/shared/company-badge"

export function AssignmentsClient({ initialWorkers, initialProducts, initialAssignments, activeBatch, totalBatches }: {
  initialWorkers: any[]
  initialProducts: any[]
  initialAssignments: any[]
  activeBatch: any | null
  totalBatches: number
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [workerId, setWorkerId] = useState("")
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [productQtys, setProductQtys] = useState<Record<string, { boxes: number; units: number }>>({})

  // Sheet historial
  const [historialAssignment, setHistorialAssignment] = useState<any | null>(null)

  // Dialog cierre
  const [closingAssignment, setClosingAssignment] = useState<any | null>(null)

  // Estado de acordeones: sets de los que están EXPANDIDOS (vacío = todos colapsados)
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set())

  // Auditoría
  const [auditingGroup, setAuditingGroup] = useState<{
    workerId: string; workerName: string; batchDay: string; batchId: string | null; items: any[]
  } | null>(null)

  const toggleBatch = (day: string) => setExpandedBatches(prev => {
    const next = new Set(prev)
    if (next.has(day)) next.delete(day); else next.add(day)
    return next
  })
  const toggleWorker = (key: string) => setExpandedWorkers(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const { data: workers = initialWorkers } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => { const r = await fetch("/api/workers"); return r.json() },
    initialData: initialWorkers,
  })
  const { data: products = initialProducts } = useQuery({
    queryKey: ["products-available"],
    queryFn: async () => { const r = await fetch("/api/products"); return r.json() },
    initialData: initialProducts,
  })
  const { data: assignments = initialAssignments } = useQuery({
    queryKey: ["assignments-active"],
    queryFn: async () => { const r = await fetch("/api/assignments"); return r.json() },
    initialData: initialAssignments,
    refetchInterval: 30000,
  })

  const { data: batchData } = useQuery({
    queryKey: ["active-batch"],
    queryFn: async () => { const r = await fetch("/api/batch"); return r.json() },
    initialData: { activeBatch, totalBatches, canOpenNew: !activeBatch },
  })
  const currentBatch = batchData?.activeBatch ?? activeBatch
  const currentTotalBatches = batchData?.totalBatches ?? totalBatches

  const openBatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/batch", { method: "POST" })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error") }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-batch"] })
      queryClient.invalidateQueries({ queryKey: ["assignments-active"] })
      toast.success("Nuevo lote abierto")
    },
    onError: (e: any) => toast.error(e.message),
  })

  // Historial diario de una asignación
  const { data: dailySales = [] } = useQuery({
    queryKey: ["daily-sales", historialAssignment?.id],
    queryFn: async () => {
      const r = await fetch(`/api/daily-sales?assignmentId=${historialAssignment.id}`)
      return r.json()
    },
    enabled: !!historialAssignment,
  })

  const createMutation = useMutation({
    mutationFn: async (data: { workerId: string; items: { productId: string; quantityAssigned: number }[] }) => {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error") }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments-active"] })
      queryClient.invalidateQueries({ queryKey: ["products-available"] })
      toast.success("Asignación creada")
      setOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error") }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assignments-active"] })
      queryClient.invalidateQueries({ queryKey: ["products-available"] })
      const msg = data.stockRestored > 0
        ? `Asignación cerrada. Stock restaurado: +${data.stockRestored}u de ${data.productName}`
        : "Asignación cerrada. Sin sobrante para restaurar."
      toast.success(msg)
      setClosingAssignment(null)
    },
    onError: (e: any) => toast.error(e.message),
  })

  const auditMutation = useMutation({
    mutationFn: async (data: { workerId: string; batchDay: string; batchId?: string | null }) => {
      const payload: any = { workerId: data.workerId }
      if (data.batchId) {
        payload.batchId = data.batchId
      } else {
        payload.batchDay = data.batchDay
      }
      const res = await fetch("/api/assignments/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error") }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["assignments-active"] })
      queryClient.invalidateQueries({ queryKey: ["products-available"] })
      queryClient.invalidateQueries({ queryKey: ["active-batch"] })
      toast.success(`Auditoría completada. Stock devuelto: +${data.totalRestored}u`)
      setAuditingGroup(null)
    },
    onError: (e: any) => toast.error(e.message),
  })

  const resetForm = () => {
    setWorkerId("")
    setSelectedCompanyId("")
    setProductQtys({})
  }

  const companies = Array.from(new Map(products.map((p: any) => [p.company.id, p.company])).values()) as any[]
  const companyProducts = products.filter((p: any) => p.company.id === selectedCompanyId)

  const selectedItems = companyProducts
    .filter((p: any) => { const q = productQtys[p.id]; return q && (q.boxes > 0 || q.units > 0) })
    .map((p: any) => {
      const q = productQtys[p.id] || { boxes: 0, units: 0 }
      const qty = q.boxes * p.unitPerBox + q.units
      return { name: p.name as string, qty, salePrice: Number(p.salePrice), unitPerBox: p.unitPerBox as number }
    })

  const handleSubmit = () => {
    if (!workerId) { toast.error("Selecciona un trabajador"); return }
    if (!selectedCompanyId) { toast.error("Selecciona una empresa"); return }
    const items = companyProducts
      .filter((p: any) => { const q = productQtys[p.id]; return q && (q.boxes > 0 || q.units > 0) })
      .map((p: any) => {
        const q = productQtys[p.id] || { boxes: 0, units: 0 }
        return { productId: p.id, quantityAssigned: q.boxes * p.unitPerBox + q.units }
      })
    if (items.length === 0) { toast.error("Ingresa al menos una cantidad"); return }
    createMutation.mutate({ workerId, items })
  }

  // Badge de auditoría: "AUDITED" solo si todos están cerrados+auditados
  const getWorkerAuditBadge = (items: any[]) => {
    if (items.every((a: any) => a.status === "CLOSED" && a.auditStatus === "AUDITED")) return "AUDITED"
    const active = items.filter((a: any) => a.status === "ACTIVE")
    if (active.some((a: any) => a.auditStatus === "IN_REVIEW")) return "IN_REVIEW"
    return "PENDING"
  }

  // Extraer número de lote del código (ej: "LOTE-0002" → 2)
  const extractBatchNumber = (code: string) => parseInt(code.replace(/\D/g, ''), 10)

  // Agrupar por batchId (si existe) o por fecha de startDate (fallback legacy)
  const batchGroupMap: Record<string, {
    batchId: string | null; batchCode: string | null; batchNumber: number | null; day: string; items: any[]
  }> = {}
  assignments.forEach((a: any) => {
    const key = a.batchId ?? a.startDate.toString().slice(0, 10)
    const day = a.startDate.toString().slice(0, 10)
    if (!batchGroupMap[key]) {
      batchGroupMap[key] = {
        batchId: a.batchId ?? null,
        batchCode: a.batch?.code ?? null,
        batchNumber: a.batch?.code ? extractBatchNumber(a.batch.code) : null,
        day,
        items: [],
      }
    }
    batchGroupMap[key].items.push(a)
  })

  // Ordenar: batches con batchId primero (por número desc), luego legacy por fecha desc
  const sortedBatchGroups = Object.values(batchGroupMap).sort((a, b) => {
    if (a.batchId && b.batchId) return (b.batchNumber ?? 0) - (a.batchNumber ?? 0)
    if (a.batchId) return -1
    if (b.batchId) return 1
    return b.day.localeCompare(a.day)
  })

  const batches = sortedBatchGroups.map((group, index) => {
    const label = group.batchNumber ? `Lote #${group.batchNumber}` : `Lote #${index + 1}`
    const workerMap: Record<string, { worker: any; items: any[]; totalDue: number; totalPaid: number; pendingDebt: number }> = {}
    group.items.forEach((a: any) => {
      if (!workerMap[a.workerId]) {
        workerMap[a.workerId] = { worker: a.worker, items: [], totalDue: 0, totalPaid: 0, pendingDebt: 0 }
      }
      workerMap[a.workerId].items.push(a)
      workerMap[a.workerId].totalDue += a.totalDue ?? 0
      workerMap[a.workerId].totalPaid += a.totalPaid ?? 0
      workerMap[a.workerId].pendingDebt += a.pendingDebt ?? 0
    })
    return {
      key: group.batchId ?? group.day,
      day: group.day,
      batchId: group.batchId,
      label,
      totalItems: group.items.length,
      workers: Object.values(workerMap),
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Asignaciones Activas</h1>
          <p className="text-gray-500 text-sm">{assignments.length} asignación(es)</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
          <DialogTrigger asChild>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d5a9e]"
              disabled={!currentBatch}
              title={!currentBatch ? "Abre un nuevo lote antes de crear asignaciones" : undefined}
            >
              <Plus className="h-4 w-4 mr-2" /> Nueva Asignación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 pt-6 pb-2"><DialogTitle>Nueva Asignación</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
              <div>
                <label className="text-sm font-medium leading-none mb-1.5 block">Trabajador</label>
                <Select value={workerId} onValueChange={setWorkerId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar trabajador" /></SelectTrigger>
                  <SelectContent>
                    {workers.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium leading-none mb-1.5 block">Empresa / Marca</label>
                <Select value={selectedCompanyId} onValueChange={(v) => { setSelectedCompanyId(v); setProductQtys({}) }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCompanyId && companyProducts.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">No hay productos con stock disponible</p>
              )}
              {companyProducts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Cantidades por producto</label>
                  <div className="border border-gray-100 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    {companyProducts.map((p: any, idx: number) => {
                      const q = productQtys[p.id] || { boxes: 0, units: 0 }
                      const maxBoxes = Math.floor(p.stock / p.unitPerBox)
                      const maxUnits = p.stock - q.boxes * p.unitPerBox
                      const total = q.boxes * p.unitPerBox + q.units
                      return (
                        <div key={p.id} className={`px-3 py-2.5 ${idx > 0 ? "border-t border-gray-100" : ""}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{p.name}</p>
                              <p className="text-xs text-gray-400">
                                {(() => {
                                  const l = getProductLabels(p.productType)
                                  return `Disponible: ${formatUnitsToBoxes(p.stock, p.unitPerBox, l.containerShort, l.unitShort)} · ${p.unitPerBox} ${l.containerPer}`
                                })()}
                              </p>
                            </div>
                            {total > 0 && (
                              <span className="text-xs font-semibold text-[#1e3a5f] bg-blue-50 px-2 py-0.5 rounded-full">
                                {total} und.
                              </span>
                            )}
                          </div>
                          {(() => {
                            const l = getProductLabels(p.productType)
                            return p.unitPerBox > 1 ? (
                              <div className="flex items-end gap-2">
                                <div className="flex-1">
                                  <p className="text-xs text-gray-400 mb-0.5">{l.container}</p>
                                  <Input type="number" min={0} max={maxBoxes} value={q.boxes || ""} placeholder="0" className="h-8 text-sm"
                                    onChange={(e) => {
                                      const boxes = Math.max(0, Math.min(maxBoxes, Number(e.target.value) || 0))
                                      const newMaxUnits = p.stock - boxes * p.unitPerBox
                                      setProductQtys(prev => ({ ...prev, [p.id]: { ...q, boxes, units: Math.min(q.units, newMaxUnits) } }))
                                    }} />
                                </div>
                                <span className="text-gray-400 pb-1">+</span>
                                <div className="flex-1">
                                  <p className="text-xs text-gray-400 mb-0.5">{l.unit}</p>
                                  <Input type="number" min={0} max={maxUnits} value={q.units || ""} placeholder="0" className="h-8 text-sm"
                                    onChange={(e) => setProductQtys(prev => ({ ...prev, [p.id]: { ...q, units: Math.max(0, Math.min(maxUnits, Number(e.target.value) || 0)) } }))} />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p className="text-xs text-gray-400 mb-0.5">{l.unit}</p>
                                <Input type="number" min={0} max={p.stock} value={q.units || ""} placeholder="0" className="h-8 text-sm"
                                  onChange={(e) => setProductQtys(prev => ({ ...prev, [p.id]: { ...q, boxes: 0, units: Math.max(0, Math.min(p.stock, Number(e.target.value) || 0)) } }))} />
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {selectedItems.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-gray-500 font-medium mb-1">Resumen:</p>
                  {selectedItems.map((item: { name: string; qty: number; salePrice: number; unitPerBox: number }, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span>{item.name} — {formatUnitsToBoxes(item.qty, item.unitPerBox)}</span>
                      <span className="font-medium">{formatCurrency(item.qty * item.salePrice)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t px-6 py-4 flex gap-2 justify-end bg-background">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancelar</Button>
              <Button type="button" className="bg-[#1e3a5f] hover:bg-[#2d5a9e]" disabled={createMutation.isPending} onClick={handleSubmit}>
                {createMutation.isPending ? "Asignando..." : "Asignar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Banner lote activo */}
      <Card className={`border-0 shadow-sm ${currentBatch ? 'border-l-4 border-l-blue-400 bg-blue-50' : 'border-l-4 border-l-amber-400 bg-amber-50'}`}>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          {currentBatch ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-blue-800">Lote activo:</span>
              <Badge className="bg-blue-600 hover:bg-blue-600">Lote #{currentBatch.number}</Badge>
              <Badge variant="outline" className="text-green-700 border-green-300">Abierto</Badge>
              <span className="text-blue-600 text-xs">{currentBatch.code}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-amber-700 text-sm font-medium">No hay lote activo. Abre un nuevo lote para crear asignaciones.</span>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={openBatchMutation.isPending}
                onClick={() => openBatchMutation.mutate()}
              >
                {openBatchMutation.isPending ? "Abriendo..." : `Abrir Lote #${currentTotalBatches + 1}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de asignaciones: acordeón Lote > Trabajador */}
      {batches.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-12 text-gray-400">
            <ClipboardList className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">Sin asignaciones activas</p>
          </CardContent>
        </Card>
      ) : (
        batches.map((batch) => {
          const isLoteOpen = expandedBatches.has(batch.key)
          return (
            <Card key={batch.key} className="border-0 shadow-sm overflow-hidden">
              {/* Batch header colapsable */}
              <button
                type="button"
                className="w-full flex items-center gap-2 px-5 py-3 bg-gray-50 border-b hover:bg-gray-100 transition-colors"
                onClick={() => toggleBatch(batch.key)}
                aria-expanded={isLoteOpen}
              >
                {isLoteOpen
                  ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                }
                <span className="font-semibold text-gray-800">{batch.label}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-400">{formatDate(batch.day)}</span>
                <span className="ml-auto text-xs text-gray-400">{batch.totalItems} asignación(es)</span>
              </button>

              {isLoteOpen && (
                <div className="divide-y divide-gray-100">
                  {batch.workers.map((group: any) => {
                    const workerKey = `${batch.key}-${group.worker.id}`
                    const isWorkerOpen = expandedWorkers.has(workerKey)
                    return (
                      <div key={workerKey}>
                        {/* Worker header colapsable */}
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                          onClick={() => toggleWorker(workerKey)}
                          aria-expanded={isWorkerOpen}
                        >
                          {isWorkerOpen
                            ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          }
                          <div className="w-7 h-7 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                            <User className="h-3.5 w-3.5 text-[#1e3a5f]" />
                          </div>
                          <span className="font-semibold text-gray-900">{group.worker.name}</span>
                          <span className="text-xs text-gray-400">{group.items.length} producto(s)</span>
                          {(() => {
                            const audit = getWorkerAuditBadge(group.items)
                            if (audit === "AUDITED") return (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Auditado</span>
                            )
                            if (audit === "IN_REVIEW") return (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">En revisión</span>
                            )
                            return (
                              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Pendiente</span>
                            )
                          })()}
                          <div className="ml-auto text-right">
                            <p className={`text-sm font-bold ${group.pendingDebt > 0 ? "text-orange-600" : "text-green-600"}`}>
                              {formatCurrency(group.pendingDebt)}
                            </p>
                          </div>
                        </button>

                        {isWorkerOpen && (
                          <>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Producto</TableHead>
                                  <TableHead className="text-right">Asignado</TableHead>
                                  <TableHead className="text-right">Vendido</TableHead>
                                  <TableHead className="text-right">Merma</TableHead>
                                  <TableHead className="text-right">Restante</TableHead>
                                  <TableHead className="text-right">Deuda</TableHead>
                                  <TableHead className="text-right">Pagado</TableHead>
                                  <TableHead />
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.items.map((a: any) => {
                                  const isAudited = a.status === "CLOSED" && a.auditStatus === "AUDITED"
                                  return (
                                  <TableRow key={a.id} className={isAudited ? "opacity-60 bg-green-50/40" : ""}>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium text-sm">{a.product.name}</p>
                                        <CompanyBadge companyName={a.product.company.name} colorKey={a.product.company.id} />
                                        {isAudited && (
                                          <span className="text-xs text-green-600 font-semibold flex items-center gap-1 mt-0.5">
                                            <ShieldCheck className="h-3 w-3" /> Auditado
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {formatUnitsToBoxes(a.quantityAssigned, a.product.unitPerBox)}
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-green-700 font-medium">
                                      {a.totalSold ?? 0}u
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-red-600">
                                      {a.totalMerma ?? 0}u
                                    </TableCell>
                                    <TableCell className="text-right text-sm font-semibold text-blue-700">
                                      {a.remaining ?? a.quantityAssigned}u
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      {formatCurrency(a.totalDue ?? 0)}
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-gray-500">
                                      {formatCurrency(a.totalPaid ?? 0)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex gap-1 justify-end">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-gray-400 hover:text-[#1e3a5f]"
                                          title="Ver historial"
                                          onClick={() => setHistorialAssignment(a)}
                                        >
                                          <History className="h-3.5 w-3.5" />
                                        </Button>
                                        {!isAudited && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-red-400 hover:text-red-600"
                                            title="Cerrar asignación"
                                            onClick={() => setClosingAssignment(a)}
                                          >
                                            <XCircle className="h-3.5 w-3.5" />
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                            {/* Footer totales del trabajador */}
                            <div className="px-5 py-3 border-t bg-gray-50/50 flex flex-wrap items-center justify-between gap-3 text-sm">
                              <div className="flex flex-wrap gap-4">
                                <span className="text-gray-500">
                                  Cobrado: <strong>{formatCurrency(group.totalDue)}</strong>
                                </span>
                                <span className="text-gray-500">
                                  Pagado: <strong>{formatCurrency(group.totalPaid)}</strong>
                                </span>
                                <span className={group.pendingDebt > 0 ? "text-orange-600 font-semibold" : "text-green-600 font-semibold"}>
                                  Pendiente: {formatCurrency(group.pendingDebt)}
                                </span>
                              </div>
                              {group.items.some((a: any) => a.status === "ACTIVE") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-green-600 text-green-700 hover:bg-green-50"
                                  onClick={() => setAuditingGroup({
                                    workerId: group.worker.id,
                                    workerName: group.worker.name,
                                    batchDay: batch.day,
                                    batchId: batch.batchId,
                                    items: group.items.filter((a: any) => a.status === "ACTIVE"),
                                  })}
                                >
                                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                                  Auditar
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })
      )}

      {/* Sheet historial diario */}
      <Sheet open={!!historialAssignment} onOpenChange={(v) => { if (!v) setHistorialAssignment(null) }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {historialAssignment && (
            <>
              <SheetHeader className="mb-5">
                <SheetTitle>Historial — {historialAssignment.product?.name}</SheetTitle>
                <p className="text-sm text-gray-400">
                  {historialAssignment.worker?.name} · Asignado: {historialAssignment.quantityAssigned}u
                </p>
              </SheetHeader>

              <div className="space-y-3 mb-5">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-blue-500 font-medium">Asignado</p>
                    <p className="font-bold text-blue-800">{historialAssignment.quantityAssigned}u</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-green-500 font-medium">Vendido</p>
                    <p className="font-bold text-green-800">{historialAssignment.totalSold ?? 0}u</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-red-500 font-medium">Merma</p>
                    <p className="font-bold text-red-800">{historialAssignment.totalMerma ?? 0}u</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-gray-500 font-medium">Restante</p>
                    <p className="font-bold text-gray-800">{historialAssignment.remaining ?? historialAssignment.quantityAssigned}u</p>
                  </div>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mb-3">Registros diarios</h3>
              {dailySales.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin registros aún</p>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs">Fecha</TableHead>
                        <TableHead className="text-right text-xs">Vendido</TableHead>
                        <TableHead className="text-right text-xs">Merma</TableHead>
                        <TableHead className="text-right text-xs">Pagó</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailySales.map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-sm text-gray-600">{formatDate(new Date(d.date))}</TableCell>
                          <TableCell className="text-right text-sm text-green-700 font-medium">{d.quantitySold}u</TableCell>
                          <TableCell className="text-right text-sm text-red-500">{d.quantityMerma}u</TableCell>
                          <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(d.amountPaid))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total a cobrar:</span>
                  <span className="font-bold">{formatCurrency(historialAssignment.totalDue ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total pagado:</span>
                  <span className="font-semibold">{formatCurrency(historialAssignment.totalPaid ?? 0)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1.5">
                  <span className="font-semibold">Saldo pendiente:</span>
                  <span className={`font-bold ${(historialAssignment.pendingDebt ?? 0) > 0 ? "text-orange-600" : "text-green-600"}`}>
                    {formatCurrency(historialAssignment.pendingDebt ?? 0)}
                  </span>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog auditoría */}
      <Dialog open={!!auditingGroup} onOpenChange={(v) => { if (!v) setAuditingGroup(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Auditar trabajador</DialogTitle>
          </DialogHeader>
          {auditingGroup && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Cerrar todas las asignaciones activas de <strong>{auditingGroup.workerName}</strong> en este lote.
                El stock restante se devuelve automáticamente al inventario.
              </p>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Stock a devolver
                </div>
                {auditingGroup.items.map((a: any) => (
                  <div key={a.id} className="px-4 py-2.5 border-t border-gray-100 flex justify-between items-center text-sm">
                    <div>
                      <p className="font-medium">{a.product.name}</p>
                      <p className="text-xs text-gray-400">{a.product.company.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-700">+{a.remaining ?? 0}u</p>
                      <p className="text-xs text-gray-400">de {a.quantityAssigned}u asignadas</p>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2.5 border-t bg-blue-50 flex justify-between text-sm font-semibold text-blue-800">
                  <span>Total a devolver:</span>
                  <span>+{auditingGroup.items.reduce((s: number, a: any) => s + (a.remaining ?? 0), 0)}u</span>
                </div>
              </div>

              {auditingGroup.items.some((a: any) => (a.pendingDebt ?? 0) > 0) && (
                <div className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-xl p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-orange-700">
                    Hay saldo pendiente. La asignación se cierra pero la deuda permanece registrada.
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setAuditingGroup(null)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={auditMutation.isPending}
                  onClick={() => auditMutation.mutate({
                    workerId: auditingGroup.workerId,
                    batchDay: auditingGroup.batchDay,
                    batchId: auditingGroup.batchId,
                  })}
                >
                  {auditMutation.isPending ? "Auditando..." : "Confirmar auditoría"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar cierre */}
      <Dialog open={!!closingAssignment} onOpenChange={(v) => { if (!v) setClosingAssignment(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerrar asignación</DialogTitle>
          </DialogHeader>
          {closingAssignment && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                ¿Cerrar la asignación de <strong>{closingAssignment.product?.name}</strong> para{" "}
                <strong>{closingAssignment.worker?.name}</strong>?
              </p>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1.5 text-sm">
                <p className="font-semibold text-blue-800 mb-1">Se devolverá al stock:</p>
                <div className="flex justify-between">
                  <span className="text-blue-700">{closingAssignment.product?.name}:</span>
                  <span className="font-bold text-blue-900">+{closingAssignment.remaining ?? 0}u</span>
                </div>
              </div>

              {(closingAssignment.pendingDebt ?? 0) > 0 && (
                <div className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-xl p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-orange-700">
                    Saldo pendiente de{" "}
                    <strong>{formatCurrency(closingAssignment.pendingDebt)}</strong> quedará registrado.
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" onClick={() => setClosingAssignment(null)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={closeMutation.isPending}
                  onClick={() => closeMutation.mutate(closingAssignment.id)}
                >
                  {closeMutation.isPending ? "Cerrando..." : "Confirmar cierre"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
