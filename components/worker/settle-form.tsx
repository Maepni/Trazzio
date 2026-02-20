"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatUnitsToBoxes } from "@/lib/utils"
import { Package, CheckCircle2, Loader2, AlertTriangle } from "lucide-react"

const itemSchema = z.object({
  assignmentId: z.string(),
  productId: z.string(),
  productName: z.string(),
  companyName: z.string(),
  quantityAssigned: z.number(),
  salePrice: z.number(),
  unitPerBox: z.number(),
  quantityReturned: z.coerce.number().int().min(0),
  mermaQuantity: z.coerce.number().int().min(0),
  mermaReason: z.string().optional(),
  amountPaid: z.coerce.number().min(0),
})
const formSchema = z.object({ items: z.array(itemSchema), notes: z.string().optional() })
type FormData = z.infer<typeof formSchema>

// Stepper button: +/- for number inputs
function Stepper({
  value, onChange, min = 0, max,
}: {
  value: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-14 h-14 flex items-center justify-center text-2xl text-gray-500 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors font-light flex-shrink-0"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Math.max(min, Math.min(max ?? Infinity, Number(e.target.value) || 0)))}
        className="flex-1 h-14 text-center text-2xl font-bold text-gray-900 border-0 outline-none bg-white"
      />
      <button
        type="button"
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        className="w-14 h-14 flex items-center justify-center text-2xl text-[#f97316] bg-orange-50 hover:bg-orange-100 active:bg-orange-200 transition-colors font-light flex-shrink-0"
      >
        +
      </button>
    </div>
  )
}

export function SettleForm({ assignments }: { assignments: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)

  const { control, handleSubmit, watch } = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      notes: "",
      items: assignments.map((a) => ({
        assignmentId: a.id,
        productId: a.productId,
        productName: a.product.name,
        companyName: a.product.company.name,
        quantityAssigned: a.quantityAssigned,
        salePrice: Number(a.product.salePrice),
        unitPerBox: a.product.unitPerBox,
        quantityReturned: 0,
        mermaQuantity: 0,
        mermaReason: "",
        amountPaid: 0,
      })),
    },
  })

  const { fields } = useFieldArray({ control, name: "items" })
  const watchItems = watch("items")

  const calcSold = (idx: number) => {
    const item = watchItems[idx]
    if (!item) return 0
    return Math.max(0, item.quantityAssigned - (item.quantityReturned || 0) - (item.mermaQuantity || 0))
  }
  const calcDue = (idx: number) => calcSold(idx) * (watchItems[idx]?.salePrice ?? 0)

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      for (const item of data.items) {
        const res = await fetch("/api/settlements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: item.assignmentId,
            quantityReturned: item.quantityReturned,
            mermaItems: item.mermaQuantity > 0
              ? [{ productId: item.productId, quantity: item.mermaQuantity, reason: item.mermaReason }]
              : [],
            amountPaid: item.amountPaid,
            notes: data.notes || undefined,
          }),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.error || "Error al enviar rendición")
        }
      }
      toast.success("¡Rendición enviada correctamente!")
      router.push("/home")
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (assignments.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <CheckCircle2 className="h-16 w-16 text-green-400 mb-4" />
        <p className="text-lg font-semibold text-gray-700">¡Todo rendido por hoy!</p>
        <p className="text-sm text-gray-400 mt-1">No tienes productos pendientes</p>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/home")}>
          Volver al inicio
        </Button>
      </div>
    )
  }

  const currentItem = watchItems[currentIdx]

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#1e3a5f]">Rendición del Día</h2>
        <p className="text-gray-500 text-sm">
          Producto {currentIdx + 1} de {assignments.length}
        </p>
      </div>

      <div className="flex gap-1.5">
        {fields.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setCurrentIdx(idx)}
            className={`flex-1 h-2 rounded-full transition-colors ${
              idx === currentIdx ? "bg-[#f97316]" : idx < currentIdx ? "bg-green-400" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center">
                <Package className="h-5 w-5 text-[#f97316]" />
              </div>
              <div>
                <CardTitle className="text-base leading-tight">{currentItem?.productName}</CardTitle>
                <p className="text-xs text-gray-400 mt-0.5">{currentItem?.companyName}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-3 flex justify-between items-center">
              <span className="text-sm text-blue-700 font-medium">Asignado:</span>
              <span className="font-bold text-blue-900 text-base">
                {formatUnitsToBoxes(currentItem?.quantityAssigned ?? 0, currentItem?.unitPerBox ?? 1)}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  Sobrante (und.)
                </label>
                <Controller name={`items.${currentIdx}.quantityReturned`} control={control} render={({ field }) => (
                  <Stepper
                    value={Number(field.value) || 0}
                    onChange={field.onChange}
                    min={0}
                    max={currentItem?.quantityAssigned}
                  />
                )} />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Merma (und. defectuosas)
                  </span>
                </label>
                <Controller name={`items.${currentIdx}.mermaQuantity`} control={control} render={({ field }) => (
                  <Stepper
                    value={Number(field.value) || 0}
                    onChange={field.onChange}
                    min={0}
                    max={Math.max(0, (currentItem?.quantityAssigned ?? 0) - (Number(watchItems[currentIdx]?.quantityReturned) || 0))}
                  />
                )} />
              </div>

              {(currentItem?.mermaQuantity ?? 0) > 0 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Motivo de merma</label>
                  <Controller name={`items.${currentIdx}.mermaReason`} control={control} render={({ field }) => (
                    <Textarea placeholder="Describe el problema..." rows={2} className="resize-none" {...field} />
                  )} />
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Vendido:</span>
                <span className="font-semibold">{calcSold(currentIdx)} und.</span>
              </div>
              <div className="flex justify-between items-center border-t pt-2 mt-1">
                <span className="text-sm font-semibold text-gray-700">Total a pagar:</span>
                <span className="font-bold text-green-600 text-lg">{formatCurrency(calcDue(currentIdx))}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                Monto entregado al admin (S/)
              </label>
              <Controller name={`items.${currentIdx}.amountPaid`} control={control} render={({ field }) => (
                <Input type="number" step="0.01" min={0} {...field} className="text-center text-xl h-14 font-bold" />
              )} />
            </div>

            {/* Global notes — only show on last product */}
            {currentIdx === fields.length - 1 && (
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  Notas (opcional)
                </label>
                <Controller name="notes" control={control} render={({ field }) => (
                  <Textarea
                    placeholder="Algún comentario del día..."
                    rows={2}
                    className="resize-none"
                    {...field}
                  />
                )} />
              </div>
            )}

            <div className="flex gap-3 pt-1">
              {currentIdx > 0 && (
                <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setCurrentIdx(currentIdx - 1)}>
                  ← Anterior
                </Button>
              )}
              {currentIdx < fields.length - 1 ? (
                <Button type="button" className="flex-1 h-12 bg-[#f97316] hover:bg-orange-600 text-white font-semibold"
                  onClick={() => setCurrentIdx(currentIdx + 1)}>
                  Siguiente →
                </Button>
              ) : (
                <Button type="submit" className="flex-1 h-12 bg-green-600 hover:bg-green-700 font-semibold" disabled={loading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                  ) : (
                    "✓ Enviar Rendición"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
