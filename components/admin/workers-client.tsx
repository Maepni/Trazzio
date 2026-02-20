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
import { Plus, Pencil, Trash2, Users, Phone, Mail } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

const createSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  phone: z.string().optional(),
  commission: z.preprocess((v) => Number(v), z.number().min(0)),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
})

const editSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  phone: z.string().optional(),
  commission: z.preprocess((v) => Number(v), z.number().min(0)),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]),
  password: z.string().min(6).or(z.literal("")).optional(),
})

type CreateForm = z.infer<typeof createSchema>
type EditForm = z.infer<typeof editSchema>
type WorkerForm = CreateForm & { password?: string }

export function WorkersClient({ initialWorkers }: { initialWorkers: any[] }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<any>(null)

  const { data: workers = initialWorkers } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const res = await fetch("/api/workers")
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    initialData: initialWorkers,
  })

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema) as Resolver<CreateForm>,
    defaultValues: { commissionType: "PERCENTAGE", commission: 0 },
  })
  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema) as Resolver<EditForm>,
    defaultValues: { commissionType: "PERCENTAGE", commission: 0 },
  })

  const activeForm = editingWorker ? editForm : createForm

  const createMutation = useMutation({
    mutationFn: async (data: CreateForm) => {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error") }
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workers"] }); toast.success("Trabajador creado"); handleClose() },
    onError: (e: any) => toast.error(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditForm }) => {
      const payload: any = { ...data }
      if (!payload.password) delete payload.password
      const res = await fetch(`/api/workers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workers"] }); toast.success("Trabajador actualizado"); handleClose() },
    onError: () => toast.error("Error al actualizar"),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workers/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Error")
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workers"] }); toast.success("Trabajador eliminado") },
    onError: () => toast.error("Error al eliminar"),
  })

  const openEdit = (worker: any) => {
    setEditingWorker(worker)
    editForm.reset({
      name: worker.name,
      phone: worker.phone ?? "",
      commission: Number(worker.commission),
      commissionType: worker.commissionType,
      password: "",
    })
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setEditingWorker(null)
    createForm.reset({ commissionType: "PERCENTAGE", commission: 0 })
    editForm.reset({ commissionType: "PERCENTAGE", commission: 0 })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Trabajadores</h1>
          <p className="text-gray-500 text-sm">{workers.length} registrados</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(v) }}>
          <DialogTrigger asChild>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d5a9e]">
              <Plus className="h-4 w-4 mr-2" />Nuevo Trabajador
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingWorker ? "Editar Trabajador" : "Nuevo Trabajador"}</DialogTitle>
            </DialogHeader>

            {editingWorker ? (
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit((d) => updateMutation.mutate({ id: editingWorker.id, data: d }))} className="space-y-3">
                  <FormField control={editForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={editForm.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="commissionType" render={({ field }) => (
                      <FormItem><FormLabel>Tipo Comisión</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="PERCENTAGE">Porcentaje (%)</SelectItem>
                            <SelectItem value="FIXED">Monto Fijo (S/)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={editForm.control} name="commission" render={({ field }) => (
                    <FormItem><FormLabel>Comisión</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editForm.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Nueva contraseña (opcional)</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex gap-2 justify-end pt-2">
                    <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2d5a9e]" disabled={updateMutation.isPending}>Guardar</Button>
                  </div>
                </form>
              </Form>
            ) : (
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-3">
                  <FormField control={createForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={createForm.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={createForm.control} name="commissionType" render={({ field }) => (
                      <FormItem><FormLabel>Tipo Comisión</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue="PERCENTAGE">
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="PERCENTAGE">Porcentaje (%)</SelectItem>
                            <SelectItem value="FIXED">Monto Fijo (S/)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={createForm.control} name="commission" render={({ field }) => (
                    <FormItem><FormLabel>Comisión</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={createForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email (acceso)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={createForm.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Contraseña</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex gap-2 justify-end pt-2">
                    <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2d5a9e]" disabled={createMutation.isPending}>Crear</Button>
                  </div>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {workers.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-12 text-gray-400">
            <Users className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No hay trabajadores registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((w: any) => (
            <Card key={w.id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center">
                      <span className="text-[#1e3a5f] font-bold text-sm">{w.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{w.name}</p>
                      <Badge variant="secondary" className="text-xs mt-0.5">
                        {w.commissionType === "PERCENTAGE"
                          ? `${Number(w.commission)}% comisión`
                          : `${formatCurrency(w.commission)} fijo`}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(w)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                      onClick={() => { if (confirm(`¿Eliminar a ${w.name}?`)) deleteMutation.mutate(w.id) }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-gray-500">
                  {w.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />{w.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />{w.user?.email}
                  </div>
                  <div className="text-gray-400 pt-0.5">
                    {w._count?.assignments ?? 0} asignaciones totales
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
