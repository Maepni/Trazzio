"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Plus, PackageOpen, AlertTriangle } from "lucide-react"
import { formatCurrency, formatUnitsToBoxes, formatDateTime } from "@/lib/utils"

export function StockClient({ initialProducts, initialEntries }: { initialProducts: any[]; initialEntries: any[] }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState("")
  const [productQtys, setProductQtys] = useState<Record<string, { boxes: number; units: number }>>({})
  const [batchNotes, setBatchNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
          <DialogTrigger asChild>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d5a9e]">
              <Plus className="h-4 w-4 mr-2" /> Registrar Ingreso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Registrar Ingreso de Mercadería</DialogTitle></DialogHeader>
            <div className="space-y-4">
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
                                Stock actual: {formatUnitsToBoxes(p.stock, p.unitPerBox)} · {p.unitPerBox} und/caja
                              </p>
                            </div>
                            {total > 0 && (
                              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                +{total} und.
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
                                <p className="text-xs text-gray-400 mb-0.5">Unidades</p>
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
                              <p className="text-xs text-gray-400 mb-0.5">Unidades</p>
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
                          )}
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

              <div className="flex gap-2 justify-end">
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
            </div>
          </DialogContent>
        </Dialog>
      </div>

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

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="px-5 py-3 border-b">
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              <PackageOpen className="h-4 w-4" /> Inventario Actual
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Precio Venta</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{p.company.name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.salePrice)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatUnitsToBoxes(p.stock, p.unitPerBox)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-gray-500">
                    {p.stock} und.
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={p.stock <= p.lowStockAlert ? "destructive" : "secondary"} className="text-xs">
                      {p.stock <= p.lowStockAlert ? "Bajo" : "OK"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="px-5 py-3 border-b">
            <h2 className="font-semibold text-gray-700">Últimos Ingresos</h2>
          </div>
          {entries.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Sin ingresos registrados</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.product.name}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{e.product.company.name}</TableCell>
                    <TableCell className="text-right font-medium">
                      +{formatUnitsToBoxes(e.quantity, e.product.unitPerBox)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-500">
                      +{e.quantity} und.
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-500">
                      {formatDateTime(e.entryDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
