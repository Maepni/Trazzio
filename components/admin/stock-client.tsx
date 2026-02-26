"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Plus, PackageOpen, AlertTriangle, ChevronDown, ChevronRight, Trash2, MinusCircle, ArrowUpCircle, ArrowDownCircle } from "lucide-react"
import { formatCurrency, formatUnitsToBoxes, formatDateTime, formatDate } from "@/lib/utils"
import { getProductLabels } from "@/lib/product-types"
import { CompanyBadge } from "@/components/shared/company-badge"
import { ProductSearchCombobox } from "@/components/shared/product-search-combobox"
import { BatchGroupCard } from "@/components/shared/batch-group-card"
import { buildVisualBatches } from "@/lib/batch-grouping"

export function StockClient({ initialProducts, initialEntries }: { initialProducts: any[]; initialEntries: any[] }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [productQtys, setProductQtys] = useState<Record<string, { boxes: number; units: number }>>({})
  const [batchNotes, setBatchNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set())
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustProductId, setAdjustProductId] = useState("")
  const [adjustQty, setAdjustQty] = useState("")
  const [adjustReason, setAdjustReason] = useState("")

  const { data: products = initialProducts } = useQuery({
    queryKey: ["products"],
    queryFn: async () => { const r = await fetch("/api/products"); return r.json() },
    initialData: initialProducts,
  })
  const { data: entries = initialEntries } = useQuery({
    queryKey: ["stock-entries"],
    queryFn: async () => { const r = await fetch("/api/stock"); return r.json() },
    initialData: initialEntries,
  })

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stock/${id}`, { method: "DELETE" })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error") }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-entries"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success("Entrada eliminada y stock corregido")
    },
    onError: (e: any) => toast.error(e.message),
  })

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(adjustQty)
      if (!adjustProductId || isNaN(qty) || qty <= 0) throw new Error("Datos inválidos")
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: adjustProductId,
          quantity: -qty,
          notes: adjustReason.trim() ? `[AJUSTE] ${adjustReason.trim()}` : "[AJUSTE]",
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error") }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-entries"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success("Ajuste registrado")
      setAdjustOpen(false)
      setAdjustProductId("")
      setAdjustQty("")
      setAdjustReason("")
    },
    onError: (e: any) => toast.error(e.message),
  })

  const companies = Array.from(new Map(products.map((p: any) => [p.company.id, p.company])).values()) as any[]
  const companyProducts = products.filter((p: any) => p.company.id === selectedCompanyId)

  const resetForm = () => {
    setSelectedCompanyId("")
    setProductQtys({})
    setBatchNotes("")
  }

  const handleSubmit = async () => {
    const toSubmit = companyProducts.filter((p: any) => {
      const q = productQtys[p.id]
      return q && (q.boxes > 0 || q.units > 0)
    })
    if (toSubmit.length === 0) {
      toast.error("Ingresa al menos una cantidad")
      return
    }
    setSubmitting(true)
    try {
      for (const p of toSubmit) {
        const q = productQtys[p.id] || { boxes: 0, units: 0 }
        const quantity = q.boxes * p.unitPerBox + q.units
        if (quantity <= 0) continue
        const res = await fetch("/api/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: p.id, quantity, boxes: q.boxes, notes: batchNotes || undefined }),
        })
        if (!res.ok) throw new Error(`Error al registrar ${p.name}`)
      }
      queryClient.invalidateQueries({ queryKey: ["stock-entries"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success("Mercadería registrada")
      setOpen(false)
      resetForm()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const lowStock = products.filter((p: any) => p.stock <= p.lowStockAlert)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Recepción de Mercadería</h1>
          <p className="text-gray-500 text-sm">Registra los ingresos de stock</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setAdjustOpen(true)}>
            <MinusCircle className="h-4 w-4 mr-2" /> Ajuste
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
          <DialogTrigger asChild>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d5a9e]">
              <Plus className="h-4 w-4 mr-2" /> Registrar Ingreso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 pt-6 pb-2"><DialogTitle>Registrar Ingreso de Mercadería</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
              {/* Selector de empresa */}
              <div>
                <label className="text-sm font-medium leading-none mb-1.5 block">Marca / Empresa</label>
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
                <p className="text-sm text-gray-400 text-center py-2">No hay productos para esta empresa</p>
              )}

              {/* Productos de la empresa con cajas + unidades */}
              {companyProducts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Cantidades por producto</label>
                  <div className="border border-gray-100 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    {companyProducts.map((p: any, idx: number) => {
                      const q = productQtys[p.id] || { boxes: 0, units: 0 }
                      const total = q.boxes * p.unitPerBox + q.units
                      return (
                        <div key={p.id} className={`px-3 py-3 ${idx > 0 ? "border-t border-gray-100" : ""}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{p.name}</p>
                              <p className="text-xs text-gray-400">
                                {(() => { const l = getProductLabels(p.productType); return `Stock actual: ${formatUnitsToBoxes(p.stock, p.unitPerBox, l.containerShort, l.unitShort)} · ${p.unitPerBox} ${l.containerPer}` })()}
                              </p>
                            </div>
                            {total > 0 && (
                              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                +{total} und.
                              </span>
                            )}
                          </div>
                          {(() => {
                            const l = getProductLabels(p.productType)
                            return p.unitPerBox > 1 ? (
                              <div className="flex items-end gap-2">
                                <div className="flex-1">
                                  <p className="text-xs text-gray-400 mb-0.5">{l.container}</p>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={q.boxes || ""}
                                    placeholder="0"
                                    className="h-8 text-sm"
                                    onChange={(e) => setProductQtys(prev => ({
                                      ...prev,
                                      [p.id]: { ...q, boxes: Math.max(0, Number(e.target.value) || 0) },
                                    }))}
                                  />
                                </div>
                                <span className="text-gray-400 pb-1">+</span>
                                <div className="flex-1">
                                  <p className="text-xs text-gray-400 mb-0.5">{l.unit}</p>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={q.units || ""}
                                    placeholder="0"
                                    className="h-8 text-sm"
                                    onChange={(e) => setProductQtys(prev => ({
                                      ...prev,
                                      [p.id]: { ...q, units: Math.max(0, Number(e.target.value) || 0) },
                                    }))}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p className="text-xs text-gray-400 mb-0.5">{l.unit}</p>
                                <Input
                                  type="number"
                                  min={0}
                                  value={q.units || ""}
                                  placeholder="0"
                                  className="h-8 text-sm"
                                  onChange={(e) => setProductQtys(prev => ({
                                    ...prev,
                                    [p.id]: { boxes: 0, units: Math.max(0, Number(e.target.value) || 0) },
                                  }))}
                                />
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium leading-none mb-1.5 block">Notas (opcional)</label>
                <Textarea rows={2} placeholder="Opcional..." value={batchNotes} onChange={e => setBatchNotes(e.target.value)} />
              </div>

            </div>
            <div className="border-t px-6 py-4 flex gap-2 justify-end bg-background">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancelar</Button>
              <Button
                type="button"
                className="bg-[#1e3a5f] hover:bg-[#2d5a9e]"
                disabled={submitting || !selectedCompanyId}
                onClick={handleSubmit}
              >
                {submitting ? "Registrando..." : "Registrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Dialog de ajuste negativo */}
      <Dialog open={adjustOpen} onOpenChange={(v) => { setAdjustOpen(v); if (!v) { setAdjustProductId(""); setAdjustQty(""); setAdjustReason("") } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Ajuste de Stock</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Reduce el inventario por pérdida, daño o conteo incorrecto.</p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Producto</label>
              <Select value={adjustProductId} onValueChange={setAdjustProductId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
                <SelectContent>
                  {products.filter((p: any) => p.stock > 0).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.company.name} — {p.name} (stock: {p.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Cantidad a reducir</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                autoComplete="off"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Razón <span className="text-gray-400 font-normal">(opcional)</span></label>
              <Input
                placeholder="Ej: Caja rota, producto vencido, error de conteo..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={adjustMutation.isPending || !adjustProductId || !adjustQty}
                onClick={() => adjustMutation.mutate()}
              >
                {adjustMutation.isPending ? "Registrando..." : "Registrar Ajuste"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {lowStock.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-400 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-red-700">
                {lowStock.length} producto(s) con stock bajo
              </span>
            </div>
            <div className="space-y-1">
              {lowStock.map((p: any) => (
                <div key={p.id} className="flex justify-between text-xs text-red-600">
                  <span>{p.company.name} — {p.name}</span>
                  <span className="font-bold">{p.stock} und. (alerta: {p.lowStockAlert})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <PackageOpen className="h-4 w-4" /> Inventario Actual
          </h2>
        </div>
        {/* Búsqueda por nombre o empresa */}
        <ProductSearchCombobox
          products={products}
          onSelect={(p) => setSearchTerm(p.name)}
          placeholder="Buscar producto o empresa..."
        />
        {/* Agrupado por empresa */}
        {(() => {
          const filtered = products.filter((p: any) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
          const grouped = Array.from(
            new Map(filtered.map((p: any) => [p.company.id, p.company])).values()
          ) as any[]

          if (filtered.length === 0) {
            return (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-10 text-center text-sm text-gray-400">
                  Sin resultados para "{searchTerm}"
                </CardContent>
              </Card>
            )
          }

          return grouped.map((company: any) => {
            const companyProds = filtered.filter((p: any) => p.company.id === company.id)
            const isCollapsed = collapsedCompanies.has(company.id)
            const toggleCollapse = () => setCollapsedCompanies(prev => {
              const next = new Set(prev)
              if (next.has(company.id)) next.delete(company.id)
              else next.add(company.id)
              return next
            })
            return (
              <Card key={company.id} className="border-0 shadow-sm overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors border-b"
                  onClick={toggleCollapse}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed
                      ? <ChevronRight className="h-4 w-4 text-gray-400" />
                      : <ChevronDown className="h-4 w-4 text-gray-400" />
                    }
                    <span className="font-semibold text-gray-800">{company.name}</span>
                    <span className="text-xs text-gray-400">({companyProds.length} productos)</span>
                  </div>
                </button>
                {!isCollapsed && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Venta</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyProds.map((p: any) => {
                        const l = getProductLabels(p.productType)
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(p.salePrice)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatUnitsToBoxes(p.stock, p.unitPerBox, l.containerShort, l.unitShort)}
                              <span className="block text-xs text-gray-400">{p.stock} {l.unitShort}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={p.stock <= p.lowStockAlert ? "destructive" : "secondary"} className="text-xs">
                                {p.stock <= p.lowStockAlert ? "Bajo" : "OK"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </Card>
            )
          })
        })()}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-gray-700 px-1">Últimos Ingresos</h2>
        {entries.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-8 text-center text-sm text-gray-400">Sin ingresos registrados</CardContent>
          </Card>
        ) : (() => {
          // Normalizar entryDate → createdAt para buildVisualBatches
          const normalized = entries.map((e: any) => ({ ...e, createdAt: e.entryDate }))
          // Agrupar por día (YYYY-MM-DD)
          const byDay = normalized.reduce((acc: Record<string, any[]>, e: any) => {
            const day = e.entryDate.toString().slice(0, 10)
            if (!acc[day]) acc[day] = []
            acc[day].push(e)
            return acc
          }, {})
          // Construir representantes de cada día para labeling
          const dayReps = Object.entries(byDay).map(([day, items]) => ({
            createdAt: (items as any[])[0].entryDate,
            day,
            items: items as any[],
          }))
          const batches = buildVisualBatches(dayReps)
          return batches.map((batch) => (
            <BatchGroupCard
              key={batch.day}
              label={batch.label}
              date={formatDate(batch.items[0].entryDate)}
              count={batch.items.length}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Hora</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.items.map((e: any) => {
                    const l = getProductLabels(e.product.productType)
                    const isAdjustment = e.quantity < 0 || e.notes?.startsWith("[AJUSTE]")
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {isAdjustment
                              ? <ArrowDownCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                              : <ArrowUpCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                            }
                            {e.product.name}
                            {e.notes?.startsWith("[AJUSTE]") && (
                              <span className="text-xs text-gray-400 truncate max-w-[120px]">
                                — {e.notes.replace("[AJUSTE] ", "").replace("[AJUSTE]", "")}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><CompanyBadge companyName={e.product.company.name} colorKey={e.product.company.id} /></TableCell>
                        <TableCell className={`text-right font-medium ${isAdjustment ? "text-red-600" : "text-green-700"}`}>
                          {isAdjustment ? "" : "+"}{formatUnitsToBoxes(Math.abs(e.quantity), e.product.unitPerBox, l.containerShort, l.unitShort)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-gray-500">
                          {formatDateTime(e.entryDate)}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isAdjustment && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-400 hover:text-red-600"
                              title="Eliminar entrada (error de ingreso)"
                              onClick={() => {
                                if (confirm(`¿Eliminar esta entrada de ${e.product.name}? Se restará ${e.quantity} del stock.`))
                                  deleteEntryMutation.mutate(e.id)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </BatchGroupCard>
          ))
        })()}
      </div>
    </div>
  )
}
