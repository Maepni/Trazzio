"use client"

import { useState } from "react"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Plus, Pencil } from "lucide-react"

const schema = z.object({
  name: z.string().min(1, "Requerido"),
  costPrice: z.string().min(1, "Requerido"),
  salePrice: z.string().min(1, "Requerido"),
  unitPerBox: z.string().min(1, "Requerido"),
  lowStockAlert: z.string().default("10"),
  category: z.enum(["CONSERVA", "CHOCOLATE", "LECHE", "ARROZ", "OTRO"]).default("CONSERVA"),
  isSpecial: z.boolean().default(false),
})
type ProductForm = z.infer<typeof schema>

interface Props {
  companyId: string
  companyName: string
  product?: any
}

export function ProductDialog({ companyId, companyName, product }: Props) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const isEdit = !!product

  const form = useForm<ProductForm>({
    resolver: zodResolver(schema) as any,
    defaultValues: product
      ? {
          name: product.name,
          costPrice: String(Number(product.costPrice)),
          salePrice: String(Number(product.salePrice)),
          unitPerBox: String(product.unitPerBox),
          lowStockAlert: String(product.lowStockAlert),
          category: (product.category as "CONSERVA" | "CHOCOLATE" | "LECHE" | "ARROZ" | "OTRO") ?? "CONSERVA",
          isSpecial: product.isSpecial ?? false,
        }
      : { lowStockAlert: "10", category: "CONSERVA" as const, isSpecial: false },
  })

  const mutation = useMutation({
    mutationFn: async (data: ProductForm) => {
      const url = isEdit ? `/api/products/${product.id}` : "/api/products"
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          companyId,
          costPrice: parseFloat(data.costPrice),
          salePrice: parseFloat(data.salePrice),
          unitPerBox: parseInt(data.unitPerBox),
          lowStockAlert: parseInt(data.lowStockAlert),
        }),
      })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] })
      toast.success(isEdit ? "Producto actualizado" : "Producto creado")
      setOpen(false)
      if (!isEdit) form.reset()
    },
    onError: () => toast.error("Error al guardar producto"),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] })
      toast.success("Producto eliminado")
      setOpen(false)
    },
    onError: () => toast.error("Error al eliminar"),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
            <Plus className="h-3 w-3" /> Producto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Producto" : `Nuevo Producto — ${companyName}`}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl><Input placeholder="Nombre del producto" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="costPrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio Costo (S/)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      autoComplete="off"
                      autoCorrect="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="salePrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>Precio Venta (S/)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      autoComplete="off"
                      autoCorrect="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="unitPerBox" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidades por Caja</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="24"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lowStockAlert" render={({ field }) => (
                <FormItem>
                  <FormLabel>Alerta Stock (und.)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="10"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CONSERVA">Conserva</SelectItem>
                    <SelectItem value="CHOCOLATE">Chocolate</SelectItem>
                    <SelectItem value="LECHE">Leche</SelectItem>
                    <SelectItem value="ARROZ">Arroz</SelectItem>
                    <SelectItem value="OTRO">Otro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="isSpecial" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div>
                  <FormLabel className="cursor-pointer">Producto especial</FormLabel>
                  <p className="text-xs text-gray-500">Marcar si no es una conserva estándar</p>
                </div>
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4 accent-orange-500"
                  />
                </FormControl>
              </FormItem>
            )} />
            <div className="flex gap-2 justify-end pt-2">
              {isEdit && (
                <Button type="button" variant="destructive" size="sm"
                  onClick={() => { if (confirm("¿Eliminar este producto?")) deleteMutation.mutate() }}
                  disabled={deleteMutation.isPending}>
                  Eliminar
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2d5a9e]" disabled={mutation.isPending}>
                {isEdit ? "Guardar" : "Crear"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
