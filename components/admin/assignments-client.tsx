"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, useFieldArray, type Resolver } from "react-hook-form"
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
import { Plus, Trash2, ClipboardList, User } from "lucide-react"
import { formatCurrency, formatUnitsToBoxes, formatDateTime } from "@/lib/utils"

const itemSchema = z.object({
  productId: z.string().min(1, "Requerido"),
  quantityAssigned: z.preprocess((v) => Number(v), z.number().int().positive("Debe ser > 0")),
})
const schema = z.object({
  workerId: z.string().min(1, "Selecciona un trabajador"),
  items: z.array(itemSchema).min(1, "Agrega al menos un producto"),
})
type AssignForm = z.infer<typeof schema>

export function AssignmentsClient({ initialWorkers, initialProducts, initialAssignments }: {
  initialWorkers: any[]; initialProducts: any[]; initialAssignments: any[]
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: workers = initialWorkers } = useQuery({
    queryKey: ["workers"], queryFn: async () => { const r = await fetch("/api/workers"); return r.json() }, initialData: initialWorkers,
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

  const form = useForm<AssignForm>({
    resolver: zodResolver(schema) as Resolver<AssignForm>,
    defaultValues: { items: [{ productId: "", quantityAssigned: 1 }] },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const watchItems = form.watch("items")
  const watchWorkerId = form.watch("workerId")

  const mutation = useMutation({
    mutationFn: async (data: AssignForm) => {
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
      form.reset({ items: [{ productId: "", quantityAssigned: 1 }] })
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

  const getProductById = (id: string) => products.find((p: any) => p.id === id)
  const calcTotal = (productId: string, qty: number) => {
    const p = getProductById(productId)
    return p ? qty * Number(p.salePrice) : 0
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d5a9e]">
              <Plus className="h-4 w-4 mr-2" /> Nueva Asignación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nueva Asignación</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="workerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trabajador</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar trabajador" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {workers.map((w: any) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FormLabel>Productos</FormLabel>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => append({ productId: "", quantityAssigned: 1 })}>
                      <Plus className="h-3 w-3 mr-1" /> Agregar
                    </Button>
                  </div>
                  {fields.map((field, idx) => {
                    const p = getProductById(watchItems[idx]?.productId)
                    return (
                      <div key={field.id} className="flex gap-2 items-start">
                        <FormField control={form.control} name={`items.${idx}.productId`} render={({ field }) => (
                          <FormItem className="flex-1">
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Producto" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {products.map((p: any) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({p.stock} und.)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`items.${idx}.quantityAssigned`} render={({ field }) => (
                          <FormItem className="w-24">
                            <FormControl>
                              <Input type="number" min={1} max={p?.stock} placeholder="Cant." className="h-9" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        {fields.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-400" onClick={() => remove(idx)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {watchItems.some(i => i.productId) && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="text-gray-500 font-medium mb-1">Resumen:</p>
                    {watchItems.map((item, idx) => {
                      const p = getProductById(item.productId)
                      if (!p) return null
                      return (
                        <div key={idx} className="flex justify-between text-xs">
                          <span>{p.name} × {item.quantityAssigned}</span>
                          <span className="font-medium">{formatCurrency(calcTotal(item.productId, item.quantityAssigned))}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => { setOpen(false); form.reset({ items: [{ productId: "", quantityAssigned: 1 }] }) }}>Cancelar</Button>
                  <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2d5a9e]" disabled={mutation.isPending}>
                    {mutation.isPending ? "Asignando..." : "Asignar"}
                  </Button>
                </div>
              </form>
            </Form>
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
                  <TableHead className="text-right">Valor</TableHead>
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
