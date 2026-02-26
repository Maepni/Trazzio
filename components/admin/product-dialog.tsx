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
import { Plus, Pencil } from "lucide-react"
import { getProductLabels, PRODUCT_TYPE_OPTIONS, type ProductType } from "@/lib/product-types"

const schema = z.object({
  name: z.string().min(1, "Requerido"),
  costPrice: z.string().min(1, "Requerido"),
  salePrice: z.string().min(1, "Requerido"),
  unitPerBox: z.string().min(1, "Requerido"),
  lowStockAlert: z.string().default("10"),
  productType: z.enum(["ESTANDAR", "LECHE", "ARROZ"]).default("ESTANDAR"),
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
          productType: (product.productType as ProductType) ?? "ESTANDAR",
        }
      : { lowStockAlert: "10", productType: "ESTANDAR" as const },
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
            <FormField control={form.control} name="productType" render={({ field }) => {
              const labels = getProductLabels(field.value)
              return (
                <FormItem>
                  <FormLabel>Tipo de producto</FormLabel>
                  <div className="flex flex-col gap-1.5">
                    {PRODUCT_TYPE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                          field.value === opt.value
                            ? "border-[#1e3a5f] bg-[#1e3a5f]/5"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          value={opt.value}
                          checked={field.value === opt.value}
                          onChange={() => field.onChange(opt.value)}
                          className="accent-[#1e3a5f]"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )
            }} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="unitPerBox" render={({ field }) => {
                const labels = getProductLabels(form.watch("productType"))
                return (
                  <FormItem>
                    <FormLabel>{labels.unit} por {labels.container.slice(0, -1) || labels.container}</FormLabel>
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
                )
              }} />
              <FormField control={form.control} name="lowStockAlert" render={({ field }) => (
                <FormItem>
                  <FormLabel>Alerta Stock</FormLabel>
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
