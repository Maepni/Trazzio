"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Building2 } from "lucide-react"
import { formatCurrency, formatUnitsToBoxes } from "@/lib/utils"
import { ProductDialog } from "@/components/admin/product-dialog"

const companySchema = z.object({ name: z.string().min(1, "Nombre requerido") })
type CompanyForm = z.infer<typeof companySchema>

async function fetchCompanies() {
  const res = await fetch("/api/companies")
  if (!res.ok) throw new Error("Error al cargar empresas")
  return res.json()
}

export function CompaniesClient({ initialCompanies }: { initialCompanies: any[] }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<any>(null)
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)

  const { data: companies = initialCompanies } = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
    initialData: initialCompanies,
  })

  const form = useForm<CompanyForm>({ resolver: zodResolver(companySchema) })

  const createMutation = useMutation({
    mutationFn: async (data: CompanyForm) => {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Error al crear empresa")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] })
      toast.success("Empresa creada")
      setOpen(false)
      form.reset()
    },
    onError: () => toast.error("Error al crear empresa"),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CompanyForm }) => {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Error al actualizar")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] })
      toast.success("Empresa actualizada")
      setEditingCompany(null)
      setOpen(false)
      form.reset()
    },
    onError: () => toast.error("Error al actualizar empresa"),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/companies/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error al eliminar")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] })
      toast.success("Empresa eliminada")
    },
    onError: () => toast.error("Error al eliminar empresa"),
  })

  const onSubmit = (data: CompanyForm) => {
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const openEdit = (company: any) => {
    setEditingCompany(company)
    form.setValue("name", company.name)
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setEditingCompany(null)
    form.reset()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Empresas y Productos</h1>
          <p className="text-gray-500 text-sm">{companies.length} empresas registradas</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(v) }}>
          <DialogTrigger asChild>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d5a9e]">
              <Plus className="h-4 w-4 mr-2" /> Nueva Empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCompany ? "Editar Empresa" : "Nueva Empresa"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl><Input placeholder="Nombre de la empresa" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
                  <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2d5a9e]"
                    disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingCompany ? "Guardar" : "Crear"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {companies.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Building2 className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No hay empresas registradas</p>
            </CardContent>
          </Card>
        ) : (
          companies.map((company: any) => (
            <Card key={company.id} className="border-0 shadow-sm overflow-hidden">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedCompany === company.id
                    ? <ChevronDown className="h-4 w-4 text-gray-400" />
                    : <ChevronRight className="h-4 w-4 text-gray-400" />
                  }
                  <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-[#1e3a5f]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{company.name}</p>
                    <p className="text-xs text-gray-400">
                      {company._count?.products ?? company.products?.length ?? 0} productos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <ProductDialog companyId={company.id} companyName={company.name} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(company)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (confirm(`¿Eliminar "${company.name}" y todos sus productos?`))
                        deleteMutation.mutate(company.id)
                    }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {expandedCompany === company.id && (
                <div className="border-t bg-gray-50/50">
                  {!company.products?.length ? (
                    <p className="text-center text-sm text-gray-400 py-6">Sin productos. Agrega uno.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                          <TableHead className="text-right">Venta</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Alerta</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {company.products.map((product: any) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell className="text-right text-gray-600">
                              {formatCurrency(product.costPrice)}
                            </TableCell>
                            <TableCell className="text-right text-gray-600">
                              {formatCurrency(product.salePrice)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={product.stock <= product.lowStockAlert ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {formatUnitsToBoxes(product.stock, product.unitPerBox)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-gray-500 text-xs">
                              {product.lowStockAlert} und.
                            </TableCell>
                            <TableCell className="text-right">
                              <ProductDialog companyId={company.id} companyName={company.name} product={product} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
