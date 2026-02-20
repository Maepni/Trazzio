"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Plus, PackageOpen, AlertTriangle } from "lucide-react"
import { formatCurrency, formatUnitsToBoxes, formatDateTime } from "@/lib/utils"

const schema = z.object({
  productId: z.string().min(1, "Selecciona un producto"),
  quantity: z.preprocess((v) => Number(v), z.number().int().positive("Debe ser mayor a 0")),
  boxes: z.preprocess((v) => (v ? Number(v) : undefined), z.number().int().min(0).optional()),
  notes: z.string().optional(),
})
type StockForm = { productId: string; quantity: number; boxes?: number; notes?: string }

export function StockClient({ initialProducts, initialEntries }: { initialProducts: any[]; initialEntries: any[] }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

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

  const form = useForm<StockForm>({ resolver: zodResolver(schema) as Resolver<StockForm>, defaultValues: { boxes: 0 } })
  const selectedProductId = form.watch("productId")
  const selectedProduct = products.find((p: any) => p.id === selectedProductId)

  const mutation = useMutation({
    mutationFn: async (data: StockForm) => {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Error al registrar")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-entries"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success("Mercadería registrada")
      setOpen(false)
      form.reset()
    },
    onError: () => toast.error("Error al registrar mercadería"),
  })

  const lowStock = products.filter((p: any) => p.stock <= p.lowStockAlert)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Recepción de Mercadería</h1>
          <p className="text-gray-500 text-sm">Registra los ingresos de stock</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d5a9e]">
              <Plus className="h-4 w-4 mr-2" /> Registrar Ingreso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Ingreso de Mercadería</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="productId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Producto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {products.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.company.name} — {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {selectedProduct && (
                  <div className="bg-blue-50 rounded-lg p-3 text-sm">
                    <span className="text-blue-700 font-medium">Stock actual: </span>
                    <span className="text-blue-900 font-bold">
                      {formatUnitsToBoxes(selectedProduct.stock, selectedProduct.unitPerBox)}
                    </span>
                    <span className="text-blue-500 text-xs ml-2">({selectedProduct.unitPerBox} und/caja)</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="quantity" render={({ field }) => (
                    <FormItem><FormLabel>Unidades</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="boxes" render={({ field }) => (
                    <FormItem><FormLabel>Cajas (referencia)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} placeholder="Opcional..." {...field} /></FormControl></FormItem>
                )} />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => { setOpen(false); form.reset() }}>Cancelar</Button>
                  <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2d5a9e]" disabled={mutation.isPending}>
                    {mutation.isPending ? "Registrando..." : "Registrar"}
                  </Button>
                </div>
              </form>
            </Form>
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
                  <TableHead className="text-right">Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.product.name}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{e.product.company.name}</TableCell>
                    <TableCell className="text-right">
                      +{formatUnitsToBoxes(e.quantity, e.product.unitPerBox)}
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
