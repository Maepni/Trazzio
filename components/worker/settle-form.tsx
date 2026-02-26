"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { formatCurrency, formatUnitsToBoxes } from "@/lib/utils"
import { getProductLabels } from "@/lib/product-types"
import { Package, CheckCircle2, Loader2, AlertTriangle, ChevronRight } from "lucide-react"
import { CompanyBadge } from "@/components/shared/company-badge"

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

// BoxUnitStepper para cajas + unidades
function BoxUnitStepper({ value, onChange, unitPerBox, max, productType }: {
  value: number; onChange: (v: number) => void; unitPerBox: number; max: number; productType?: string
}) {
  if (unitPerBox <= 1) {
    return <Stepper value={value} onChange={onChange} min={0} max={max} />
  }
  const labels = getProductLabels(productType)
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
        <p className="text-xs text-center text-gray-500 mb-1">{labels.container}</p>
        <Stepper value={boxes} onChange={setBoxes} min={0} max={maxBoxes} />
      </div>
      <div className="pb-2 text-gray-400 text-xl font-light flex-shrink-0">+</div>
      <div className="flex-1">
        <p className="text-xs text-center text-gray-500 mb-1">{labels.unit}</p>
        <Stepper value={units} onChange={setUnits} min={0} max={maxUnitsForBoxes} />
      </div>
    </div>
  )
}

type ItemState = {
  assignmentId: string
  productName: string
  companyName: string
  salePrice: number
  unitPerBox: number
  productType: string
  remaining: number
  pendingDebt: number
  quantitySold: number
  quantityMerma: number
  amountPaid: string
  notes: string
}

type Step = "form" | "summary"

export function SettleForm({ assignments }: { assignments: any[] }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("form")
  const [loading, setLoading] = useState(false)

  const [items, setItems] = useState<ItemState[]>(
    assignments.map((a) => ({
      assignmentId: a.id,
      productName: a.product.name,
      companyName: a.product.company.name,
      salePrice: Number(a.product.salePrice),
      unitPerBox: a.product.unitPerBox,
      productType: a.product.productType ?? "ESTANDAR",
      remaining: a.remaining ?? 0,
      pendingDebt: a.pendingDebt ?? 0,
      quantitySold: 0,
      quantityMerma: 0,
      amountPaid: "",
      notes: "",
    }))
  )

  const updateItem = (idx: number, field: keyof ItemState, value: number | string) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      // Clamp merma: no puede superar remaining - vendido
      if (field === "quantitySold") {
        const maxMerma = Math.max(0, item.remaining - (value as number))
        updated.quantityMerma = Math.min(item.quantityMerma, maxMerma)
      }
      return updated
    }))
  }

  // Solo incluir items con algún movimiento
  const activeItems = items.filter(
    item => item.quantitySold > 0 || item.quantityMerma > 0 || (Number(item.amountPaid) || 0) > 0
  )

  const totalSoldToday = activeItems.reduce((sum, i) => sum + i.quantitySold * i.salePrice, 0)
  const totalPaidToday = activeItems.reduce((sum, i) => sum + (Number(i.amountPaid) || 0), 0)

  const handleConfirm = () => {
    // Validar
    for (const item of items) {
      if (item.quantitySold + item.quantityMerma > item.remaining) {
        toast.error(`"${item.productName}": vendido + merma supera el restante (${item.remaining}u)`)
        return
      }
    }
    if (activeItems.length === 0) {
      toast.error("No hay nada que registrar. Ingresa ventas, merma o pago en al menos un producto.")
      return
    }
    setStep("summary")
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const payload = activeItems.map(item => ({
        assignmentId: item.assignmentId,
        quantitySold: item.quantitySold,
        quantityMerma: item.quantityMerma,
        amountPaid: Number(item.amountPaid) || 0,
        notes: item.notes || undefined,
      }))

      const res = await fetch("/api/daily-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || "Error al registrar")
      }

      toast.success("¡Registro del día enviado!")
      router.push("/home")
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
      setStep("form")
    } finally {
      setLoading(false)
    }
  }

  if (assignments.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <CheckCircle2 className="h-16 w-16 text-green-400 mb-4" />
        <p className="text-lg font-semibold text-gray-700">Sin productos activos</p>
        <p className="text-sm text-gray-400 mt-1">No tienes asignaciones pendientes</p>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/home")}>
          Volver al inicio
        </Button>
      </div>
    )
  }

  // Paso 2: Resumen
  if (step === "summary") {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div>
          <h2 className="text-xl font-bold text-[#1e3a5f]">Confirmar registro</h2>
          <p className="text-gray-500 text-sm">{activeItems.length} producto(s) con movimiento</p>
        </div>

        <div className="space-y-2">
          {activeItems.map((item, idx) => (
            <Card key={idx} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="font-semibold text-gray-900">{item.productName}</p>
                <div className="mb-2"><CompanyBadge companyName={item.companyName} colorKey={item.companyName} /></div>
                <div className="flex gap-4 text-sm flex-wrap">
                  {item.quantitySold > 0 && (
                    <span className="text-green-700">
                      Vendido: <strong>{item.quantitySold}u</strong>
                    </span>
                  )}
                  {item.quantityMerma > 0 && (
                    <span className="text-red-600">
                      Merma: <strong>{item.quantityMerma}u</strong>
                    </span>
                  )}
                  {(Number(item.amountPaid) || 0) > 0 && (
                    <span className="text-[#1e3a5f]">
                      Pagó: <strong>{formatCurrency(Number(item.amountPaid))}</strong>
                    </span>
                  )}
                  {item.quantitySold > 0 && (
                    <span className="text-gray-500">
                      ({formatCurrency(item.quantitySold * item.salePrice)})
                    </span>
                  )}
                </div>
                {item.notes && (
                  <p className="text-xs text-gray-400 mt-1 italic">{item.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Total vendido hoy:</span>
            <span className="font-bold text-gray-900">{formatCurrency(totalSoldToday)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total pagado hoy:</span>
            <span className="font-semibold text-gray-700">{formatCurrency(totalPaidToday)}</span>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="h-12 px-5"
            onClick={() => setStep("form")}
            disabled={loading}
          >
            ← Editar
          </Button>
          <Button
            type="button"
            className="flex-1 h-12 bg-green-600 hover:bg-green-700 font-semibold"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
              : "✓ Confirmar registro"}
          </Button>
        </div>
      </div>
    )
  }

  // Paso 1: Formulario
  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-24">
      <div>
        <h2 className="text-xl font-bold text-[#1e3a5f]">Registro del día</h2>
        <p className="text-gray-500 text-sm">{assignments.length} producto(s) activo(s)</p>
      </div>

      <div className="space-y-4">
        {items.map((item, idx) => {
          const maxMerma = Math.max(0, item.remaining - item.quantitySold)
          const soldValue = item.quantitySold * item.salePrice
          const paid = Number(item.amountPaid) || 0

          return (
            <Card key={item.assignmentId} className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-4">
                {/* Header producto */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Package className="h-5 w-5 text-[#f97316]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-400">{item.companyName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">Restante calculado</p>
                    <p className="text-sm font-bold text-blue-700">
                      {formatUnitsToBoxes(item.remaining, item.unitPerBox)}
                    </p>
                  </div>
                </div>

                {/* Info rápida */}
                <div className="flex gap-2 text-xs">
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                    Asignado: {formatUnitsToBoxes(
                      assignments[idx]?.quantityAssigned ?? item.remaining,
                      item.unitPerBox
                    )}
                  </span>
                  <span className="bg-green-50 text-green-700 px-2 py-1 rounded-lg">
                    Vendido acum: {assignments[idx]?.totalSold ?? 0}u
                  </span>
                  {(assignments[idx]?.totalMerma ?? 0) > 0 && (
                    <span className="bg-red-50 text-red-600 px-2 py-1 rounded-lg">
                      Merma acum: {assignments[idx]?.totalMerma}u
                    </span>
                  )}
                </div>

                {/* Vendido hoy */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Vendido hoy
                  </label>
                  <BoxUnitStepper
                    value={item.quantitySold}
                    onChange={v => updateItem(idx, "quantitySold", v)}
                    unitPerBox={item.unitPerBox}
                    max={item.remaining}
                    productType={item.productType}
                  />
                </div>

                {/* Merma hoy */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Merma hoy (reduce deuda)
                    </span>
                  </label>
                  <Stepper
                    value={item.quantityMerma}
                    onChange={v => updateItem(idx, "quantityMerma", v)}
                    min={0}
                    max={maxMerma}
                  />
                </div>

                {/* Pago hoy */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                    Pago al admin hoy (S/)
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={item.amountPaid}
                    onChange={e => updateItem(idx, "amountPaid", e.target.value)}
                    className="text-center text-xl h-14 font-bold"
                    placeholder="0.00"
                  />
                </div>

                {/* Notas */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Notas (opcional)</label>
                  <Textarea
                    placeholder="Algún comentario..."
                    rows={2}
                    className="resize-none text-sm"
                    value={item.notes}
                    onChange={e => updateItem(idx, "notes", e.target.value)}
                  />
                </div>

                {/* Resumen del producto */}
                {(item.quantitySold > 0 || paid > 0) && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5 space-y-1 text-sm">
                    {item.quantitySold > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">A cobrar hoy:</span>
                        <span className="font-bold text-[#1e3a5f]">{formatCurrency(soldValue)}</span>
                      </div>
                    )}
                    {paid > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Deuda pendiente nueva:</span>
                        <span className="font-semibold">
                          {formatCurrency(Math.max(0, item.pendingDebt + soldValue - paid))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Botón sticky */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 max-w-lg mx-auto">
        <Button
          type="button"
          className="w-full h-12 bg-[#f97316] hover:bg-orange-600 text-white font-semibold gap-2"
          onClick={handleConfirm}
        >
          Finalizar registro del día <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
