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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, ClipboardList, User } from "lucide-react"
import { formatCurrency, formatUnitsToBoxes, formatDateTime } from "@/lib/utils"

export function AssignmentsClient({ initialWorkers, initialProducts, initialAssignments }: {
  initialWorkers: any[]; initialProducts: any[]; initialAssignments: any[]
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [workerId, setWorkerId] = useState("")
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [productQtys, setProductQtys] = useState<Record<string, { boxes: number; units: number }>>({})

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
    queryKey: ["assignments-today"],
    queryFn: async () => { const r = await fetch("/api/assignments"); return r.json() },
    initialData: initialAssignments,
    refetchInterval: 30000,
  })

  const mutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["assignments-today"] })
      queryClient.invalidateQueries({ queryKey: ["products-available"] })
      toast.success("Asignación creada")
      setOpen(false)
      resetForm()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error") }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments-today"] })
      queryClient.invalidateQueries({ queryKey: ["products-available"] })
      toast.success("Asignación eliminada y stock restaurado")
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

  const selectedItems: { name: string; qty: number; salePrice: number; unitPerBox: number }[] = companyProducts
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
      .filter((p: any) => {
        const q = productQtys[p.id]
        return q && (q.boxes > 0 || q.units > 0)
      })
      .map((p: any) => {
        const q = productQtys[p.id] || { boxes: 0, units: 0 }
        return { productId: p.id, quantityAssigned: q.boxes * p.unitPerBox + q.units }
      })
    if (items.length === 0) { toast.error("Ingresa al menos una cantidad"); return }
    mutation.mutate({ workerId, items })
  }

  const groupedByWorker = assignments.reduce((acc: any, a: any) => {
    if (!acc[a.workerId]) acc[a.workerId] = { worker: a.worker, items: [] }
    acc[a.workerId].items.push(a)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Asignaciones del Día</h1>
          <p className="text-gray-500 text-sm">{assignments.length} asignaciones hoy</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
          <DialogTrigger asChild>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d5a9e]">
              <Plus className="h-4 w-4 mr-2" /> Nueva Asignación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nueva Asignación</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Trabajador */}
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

              {/* Empresa */}
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
                <p className="text-sm text-gray-400 text-center py-2">No hay productos disponibles para esta empresa</p>
              )}

              {/* Productos con cajas + unidades */}
              {companyProducts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Cantidades por producto</label>
                  <div className="border border-gray-100 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    {companyProducts.map((p: any, idx: number) => {
                      const q = productQtys[p.id] || { boxes: 0, units: 0 }
                      const total = q.boxes * p.unitPerBox + q.units
                      const maxBoxes = Math.floor(p.stock / p.unitPerBox)
                      const maxUnits = p.stock - q.boxes * p.unitPerBox
                      return (
                        <div key={p.id} className={`px-3 py-2.5 ${idx > 0 ? "border-t border-gray-100" : ""}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{p.name}</p>
                              <p className="text-xs text-gray-400">
                                Disponible: {formatUnitsToBoxes(p.stock, p.unitPerBox)} · {p.unitPerBox} und/caja
                              </p>
                            </div>
                            {total > 0 && (
                              <span className="text-xs font-semibold text-[#1e3a5f] bg-blue-50 px-2 py-0.5 rounded-full">
                                {total} und.
                              </span>
                            )}
                          </div>
                          {p.unitPerBox > 1 ? (
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <p className="text-xs text-gray-400 mb-0.5">Cajas</p>
                                <Input
                                  type="number"
                                  min={0}
                                  max={maxBoxes}
                                  value={q.boxes || ""}
                                  placeholder="0"
                                  className="h-8 text-sm"
                                  onChange={(e) => {
                                    const boxes = Math.max(0, Math.min(maxBoxes, Number(e.target.value) || 0))
                                    const newMaxUnits = p.stock - boxes * p.unitPerBox
                                    setProductQtys(prev => ({
                                      ...prev,
                                      [p.id]: { boxes, units: Math.min(q.units, newMaxUnits) },
                                    }))
                                  }}
                                />
                              </div>
                              <span className="text-gray-400 pb-1">+</span>
                              <div className="flex-1">
                                <p className="text-xs text-gray-400 mb-0.5">Unidades</p>
                                <Input
                                  type="number"
                                  min={0}
                                  max={maxUnits}
                                  value={q.units || ""}
                                  placeholder="0"
                                  className="h-8 text-sm"
                                  onChange={(e) => setProductQtys(prev => ({
                                    ...prev,
                                    [p.id]: { ...q, units: Math.max(0, Math.min(maxUnits, Number(e.target.value) || 0)) },
                                  }))}
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs text-gray-400 mb-0.5">Unidades</p>
                              <Input
                                type="number"
                                min={0}
                                max={p.stock}
                                value={q.units || ""}
                                placeholder="0"
                                className="h-8 text-sm"
                                onChange={(e) => setProductQtys(prev => ({
                                  ...prev,
                                  [p.id]: { boxes: 0, units: Math.max(0, Math.min(p.stock, Number(e.target.value) || 0)) },
                                }))}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Resumen */}
              {selectedItems.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-gray-500 font-medium mb-1">Resumen:</p>
                  {selectedItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span>{item.name} — {formatUnitsToBoxes(item.qty, item.unitPerBox)}</span>
                      <span className="font-medium">{formatCurrency(item.qty * item.salePrice)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancelar</Button>
                <Button
                  type="button"
                  className="bg-[#1e3a5f] hover:bg-[#2d5a9e]"
                  disabled={mutation.isPending}
                  onClick={handleSubmit}
                >
                  {mutation.isPending ? "Asignando..." : "Asignar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {Object.keys(groupedByWorker).length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-12 text-gray-400">
            <ClipboardList className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">Sin asignaciones hoy</p>
          </CardContent>
        </Card>
      ) : (
        Object.values(groupedByWorker).map((group: any) => (
          <Card key={group.worker.id} className="border-0 shadow-sm">
            <div className="flex items-center gap-3 px-5 py-3 border-b bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center">
                <User className="h-4 w-4 text-[#1e3a5f]" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{group.worker.name}</p>
                <p className="text-xs text-gray-400">{group.items.length} productos asignados</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Asignado</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Valor Venta</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Hora</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{a.product.name}</p>
                        <p className="text-xs text-gray-400">{a.product.company.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUnitsToBoxes(a.quantityAssigned, a.product.unitPerBox)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-500">
                      {a.quantityAssigned} und.
                    </TableCell>
                    <TableCell className="text-right text-gray-600">
                      {formatCurrency(a.quantityAssigned * Number(a.product.salePrice))}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={a.status === "SETTLED" ? "default" : "secondary"}
                        className={a.status === "SETTLED" ? "bg-green-100 text-green-700" : "bg-orange-50 text-orange-600"}>
                        {a.status === "SETTLED" ? "Rendido" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-gray-400">
                      {formatDateTime(a.date)}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.status === "PENDING" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                          onClick={() => { if (confirm("¿Eliminar asignación?")) deleteMutation.mutate(a.id) }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))
      )}
    </div>
  )
}
