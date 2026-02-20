"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatUnitsToBoxes } from "@/lib/utils"
import { Package, CheckCircle2, Loader2, AlertTriangle } from "lucide-react"

type ItemState = {
  assignmentId: string
  productId: string
  productName: string
  companyName: string
  quantityAssigned: number
  salePrice: number
  unitPerBox: number
  quantityReturned: number
  mermaQuantity: number
  mermaReason: string
  amountPaid: string
}

// Stepper simple de unidades
function Stepper({ value, onChange, min = 0, max }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-10 h-12 flex items-center justify-center text-2xl text-gray-500 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors font-light flex-shrink-0"
      >−</button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Math.max(min, Math.min(max ?? Infinity, Number(e.target.value) || 0)))}
        onWheel={e => e.currentTarget.blur()}
        className="flex-1 h-12 text-center text-xl font-bold text-gray-900 border-0 outline-none bg-white min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        className="w-10 h-12 flex items-center justify-center text-2xl text-[#f97316] bg-orange-50 hover:bg-orange-100 active:bg-orange-200 transition-colors font-light flex-shrink-0"
      >+</button>
    </div>
  )
}

// Stepper con cajas + unidades juntos (para sobrante)
function BoxUnitStepper({ value, onChange, unitPerBox, max }: {
  value: number; onChange: (v: number) => void; unitPerBox: number; max: number
}) {
  if (unitPerBox <= 1) {
    return <Stepper value={value} onChange={onChange} min={0} max={max} />
  }

  const boxes = Math.floor(value / unitPerBox)
  const units = value % unitPerBox

  const setBoxes = (b: number) => {
    const newTotal = b * unitPerBox + units
    onChange(Math.min(max, Math.max(0, newTotal)))
  }
  const setUnits = (u: number) => {
    const newTotal = boxes * unitPerBox + u
    onChange(Math.min(max, Math.max(0, newTotal)))
  }

  const maxBoxes = Math.floor(max / unitPerBox)
  const maxUnitsForBoxes = Math.min(unitPerBox - 1, max - boxes * unitPerBox)

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <p className="text-xs text-center text-gray-500 mb-1">Cajas</p>
        <Stepper value={boxes} onChange={setBoxes} min={0} max={maxBoxes} />
      </div>
      <div className="pb-2 text-gray-400 text-xl font-light flex-shrink-0">+</div>
      <div className="flex-1">
        <p className="text-xs text-center text-gray-500 mb-1">Unidades</p>
        <Stepper value={units} onChange={setUnits} min={0} max={maxUnitsForBoxes} />
      </div>
    </div>
  )
}

export function SettleForm({ assignments }: { assignments: any[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)

  const [items, setItems] = useState<ItemState[]>(
    assignments.map((a) => ({
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
      amountPaid: "",
    }))
  )
  const [notes, setNotes] = useState("")

  const updateItem = (field: keyof ItemState, value: number | string) => {
    setItems(prev => prev.map((item, i) =>
      i === currentIdx ? { ...item, [field]: value } : item
    ))
  }

  const current = items[currentIdx]
  const isLast = currentIdx === items.length - 1

  const calcSold = (item: ItemState) => Math.max(0, item.quantityAssigned - item.quantityReturned)
  const calcDue = (item: ItemState) => calcSold(item) * item.salePrice
  const calcPaid = (item: ItemState) => Number(item.amountPaid) || 0

  const totalDue = items.reduce((sum, item) => sum + calcDue(item), 0)
  const totalPaid = items.reduce((sum, item) => sum + calcPaid(item), 0)

  const handleNext = () => {
    if (current.quantityReturned > current.quantityAssigned) {
      toast.error("El sobrante supera lo asignado")
      return
    }
    setCurrentIdx(idx => idx + 1)
  }

  const handleSubmit = async () => {
    if (current.quantityReturned > current.quantityAssigned) {
      toast.error("El sobrante supera lo asignado")
      return
    }
    setLoading(true)
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const paid = calcPaid(item)
        const res = await fetch("/api/settlements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: item.assignmentId,
            quantityReturned: item.quantityReturned,
            mermaItems: item.mermaQuantity > 0
              ? [{ productId: item.productId, quantity: item.mermaQuantity, reason: item.mermaReason }]
              : [],
            amountPaid: paid,
            notes: notes || undefined,
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

  const currentDue = calcDue(current)
  const currentPaid = calcPaid(current)
  const currentDiff = currentDue - currentPaid
  const maxReturned = current.quantityAssigned
  const maxMerma = Math.max(0, current.quantityAssigned - current.quantityReturned)

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div>
        <h2 className="text-xl font-bold text-[#1e3a5f]">Rendición del Día</h2>
        <p className="text-gray-500 text-sm">
          Producto {currentIdx + 1} de {assignments.length}
        </p>
      </div>

      {/* Barra de progreso */}
      <div className="flex gap-1.5">
        {items.map((_, idx) => (
          <div
            key={idx}
            className={`flex-1 h-2 rounded-full transition-colors ${
              idx < currentIdx ? "bg-green-400" : idx === currentIdx ? "bg-[#f97316]" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center">
              <Package className="h-5 w-5 text-[#f97316]" />
            </div>
            <div>
              <CardTitle className="text-base leading-tight">{current.productName}</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">{current.companyName}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-4 pb-4">
          {/* Asignado */}
          <div className="bg-blue-50 rounded-xl p-3 flex justify-between items-center">
            <span className="text-sm text-blue-700 font-medium">Asignado:</span>
            <span className="font-bold text-blue-900 text-base">
              {formatUnitsToBoxes(current.quantityAssigned, current.unitPerBox)}
            </span>
          </div>

          {/* Sobrante */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              Sobrante (devuelto)
            </label>
            <BoxUnitStepper
              value={current.quantityReturned}
              onChange={v => updateItem("quantityReturned", v)}
              unitPerBox={current.unitPerBox}
              max={maxReturned}
            />
          </div>

          {/* Merma — solo unidades */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Merma (reportar al admin)
              </span>
            </label>
            <Stepper
              value={current.mermaQuantity}
              onChange={v => updateItem("mermaQuantity", v)}
              min={0}
              max={maxMerma}
            />
          </div>

          {current.mermaQuantity > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                Motivo de merma
              </label>
              <Textarea
                placeholder="Describe el problema..."
                rows={2}
                className="resize-none"
                value={current.mermaReason}
                onChange={e => updateItem("mermaReason", e.target.value)}
              />
            </div>
          )}

          {/* Monto entregado al admin — por producto */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              Monto entregado al admin (S/)
            </label>
            <Input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={current.amountPaid}
              onChange={e => updateItem("amountPaid", e.target.value)}
              className="text-center text-xl h-14 font-bold"
              placeholder="0.00"
            />
          </div>

          {/* Resumen del producto */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Vendido:</span>
              <span className="font-semibold">{calcSold(current)} und.</span>
            </div>
            {current.mermaQuantity > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Merma (info):</span>
                <span className="text-orange-600 font-medium">{current.mermaQuantity} und.</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">A cobrar:</span>
              <span className="font-bold text-[#1e3a5f]">{formatCurrency(currentDue)}</span>
            </div>
            {current.amountPaid !== "" && (
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5">
                <span className="text-gray-500">Diferencia:</span>
                <span className={`font-bold ${Math.abs(currentDiff) < 0.01 ? "text-emerald-600" : "text-red-600"}`}>
                  {Math.abs(currentDiff) < 0.01 ? "S/ 0.00 ✓" : formatCurrency(currentDiff)}
                </span>
              </div>
            )}
          </div>

          {/* Resumen total + notas — solo en el último producto */}
          {isLast && (
            <div className="border border-green-200 rounded-xl p-4 space-y-3 bg-green-50/40">
              <p className="text-sm font-semibold text-gray-700">Resumen total del día</p>
              <div className="space-y-1.5 text-sm bg-white rounded-lg px-3 py-2.5 border border-green-100">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total a cobrar:</span>
                  <span className="font-bold text-gray-900">{formatCurrency(totalDue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total pagado:</span>
                  <span className="font-semibold text-gray-700">{formatCurrency(totalPaid)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-1.5">
                  <span className="font-semibold text-gray-600">Diferencia:</span>
                  <span className={`font-bold ${Math.abs(totalDue - totalPaid) < 0.01 ? "text-emerald-600" : "text-red-600"}`}>
                    {Math.abs(totalDue - totalPaid) < 0.01 ? "S/ 0.00 ✓" : formatCurrency(totalDue - totalPaid)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  Notas (opcional)
                </label>
                <Textarea
                  placeholder="Algún comentario del día..."
                  rows={2}
                  className="resize-none"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Botones de navegación */}
          <div className="flex gap-3 pt-1">
            {currentIdx > 0 && (
              <Button
                type="button"
                variant="outline"
                className="h-12 px-4"
                onClick={() => setCurrentIdx(idx => idx - 1)}
                disabled={loading}
              >
                ← Anterior
              </Button>
            )}
            {!isLast ? (
              <Button
                type="button"
                className="flex-1 h-12 bg-[#f97316] hover:bg-orange-600 text-white font-semibold"
                onClick={handleNext}
              >
                Siguiente →
              </Button>
            ) : (
              <Button
                type="button"
                className="flex-1 h-12 bg-green-600 hover:bg-green-700 font-semibold"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                  : "✓ Enviar Rendición"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
