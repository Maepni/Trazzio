# Producción + Pagos + Categorías + Precios Irregulares — Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corregir el bug de caché en producción y agregar tres funcionalidades: sistema de pagos a trabajadores, categorías de productos y precios irregulares por asignación.

**Architecture:** El bug de producción se resuelve con `export const dynamic = 'force-dynamic'` en todas las pages del App Router, forzando SSR real en lugar de SSG. El resto de funcionalidades extienden el schema Prisma con nuevos modelos/campos y agregan rutas API + UI correspondientes.

**Tech Stack:** Next.js 14 App Router, Prisma v5 (db push, NO migrate), TypeScript, TanStack Query v5, Tailwind CSS + shadcn/ui, NextAuth v5 beta.

---

## DIAGNÓSTICO DEL BUG DE PRODUCCIÓN

**Causa raíz:** Las pages como `app/(admin)/companies/page.tsx` hacen `prisma.findMany()` directamente **sin llamar** a `auth()` ni `cookies()`/`headers()`. En `next build`, Next.js las interpreta como páginas estáticas (SSG) y las renderiza **una sola vez** con los datos que había en la BD al momento del build (los del seed). Los datos creados después no aparecen porque se sirve el HTML cacheado.

**Por qué el DELETE falla la segunda vez:** El item existe en el HTML cacheado (initialData de React Query) pero ya fue eliminado de la BD. Al intentar eliminar de nuevo, la API devuelve 404.

**Fix:** `export const dynamic = 'force-dynamic'` en cada `page.tsx` que consulte datos dinámicos.

---

## Task 1: Fix Bug de Producción — Forzar SSR en Todas las Pages

**Files:**
- Modify: `app/(admin)/companies/page.tsx`
- Modify: `app/(admin)/workers/page.tsx`
- Modify: `app/(admin)/stock/page.tsx`
- Modify: `app/(admin)/assignments/page.tsx`
- Modify: `app/(admin)/settlements/page.tsx`
- Modify: `app/(admin)/reports/page.tsx`
- Modify: `app/(admin)/dashboard/page.tsx`
- Modify: `app/(worker)/home/page.tsx`
- Modify: `app/(worker)/settle/page.tsx`

**Step 1: Agregar dynamic export a cada page**

En cada uno de los 9 archivos arriba, agregar esta línea al principio del archivo (después de los imports):

```typescript
export const dynamic = 'force-dynamic'
```

Ejemplo completo para `app/(admin)/companies/page.tsx`:
```typescript
import { prisma } from "@/lib/prisma"
import { CompaniesClient } from "@/components/admin/companies-client"
import { serialize } from "@/lib/utils"

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    include: {
      products: true,
      _count: { select: { products: true } },
    },
    orderBy: { name: "asc" },
  })
  return <CompaniesClient initialCompanies={serialize(companies)} />
}
```

Repetir el mismo patrón para las otras 8 pages, agregando solo la línea `export const dynamic = 'force-dynamic'` después de los imports.

**Step 2: Verificar tipos**
```bash
cd /home/mapins/Escritorio/trazzio && npx tsc --noEmit
```
Expected: 0 errores.

**Step 3: Probar en modo producción localmente**
```bash
cd /home/mapins/Escritorio/trazzio && npm run build && npm run start
```
Crear una empresa nueva → debe aparecer inmediatamente sin recargar.
Eliminar una empresa → debe desaparecer. Intentar eliminar de nuevo → debe dar "Empresa no encontrada" (404 correcto).

**Step 4: Commit**
```bash
cd /home/mapins/Escritorio/trazzio
git add app/(admin)/companies/page.tsx app/(admin)/workers/page.tsx \
  app/(admin)/stock/page.tsx app/(admin)/assignments/page.tsx \
  app/(admin)/settlements/page.tsx app/(admin)/reports/page.tsx \
  app/(admin)/dashboard/page.tsx app/(worker)/home/page.tsx \
  app/(worker)/settle/page.tsx
git commit -m "fix: forzar SSR en todas las pages para evitar datos estáticos en producción"
```

---

## Task 2: Schema Prisma — WorkerPayment + Categorías + CustomSalePrice

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Agregar los nuevos campos y modelo**

Reemplazar el schema existente con estas adiciones:

En `Product`, agregar después de `stock Int @default(0)`:
```prisma
  category      ProductCategory @default(CONSERVA)
  isSpecial     Boolean         @default(false)
```

En `Assignment`, agregar después de `quantitySold Int?`:
```prisma
  customSalePrice Decimal? @db.Decimal(10, 2)
```

En `Worker`, agregar después de `assignments Assignment[]`:
```prisma
  payments WorkerPayment[]
```

Agregar el nuevo modelo después de `StockEntry`:
```prisma
model WorkerPayment {
  id        String   @id @default(cuid())
  workerId  String
  worker    Worker   @relation(fields: [workerId], references: [id], onDelete: Cascade)
  amount    Decimal  @db.Decimal(10, 2)
  paidAt    DateTime @default(now())
  notes     String?
  createdAt DateTime @default(now())
}
```

Agregar el nuevo enum al final:
```prisma
enum ProductCategory {
  CONSERVA
  CHOCOLATE
  LECHE
  ARROZ
  OTRO
}
```

**Step 2: Aplicar el schema a la BD**
```bash
cd /home/mapins/Escritorio/trazzio && npx prisma db push
```
Expected: `Your database is now in sync with your Prisma schema.`

> ⚠️ NO usar `prisma migrate` — este proyecto usa `db push`.

**Step 3: Verificar tipos generados**
```bash
npx tsc --noEmit
```
Expected: 0 errores (Prisma regenera los tipos automáticamente con db push).

**Step 4: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat: agregar WorkerPayment, categorías de producto y customSalePrice en assignment"
```

---

## Task 3: API — Pagos de Trabajadores (`/api/payments`)

**Files:**
- Create: `app/api/payments/route.ts`

**Step 1: Crear el route handler**

```typescript
// app/api/payments/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const schema = z.object({
  workerId: z.string().min(1),
  amount: z.preprocess((v) => Number(v), z.number().positive("El monto debe ser positivo")),
  notes: z.string().optional(),
})

// GET /api/payments?workerId=xxx — balance de un trabajador (admin o el propio trabajador)
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workerId = searchParams.get("workerId")

  // Si es WORKER, solo puede ver su propio balance
  if (session.user.role === "WORKER") {
    if (!session.user.workerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    return NextResponse.json(await getWorkerBalance(session.user.workerId))
  }

  // ADMIN puede ver cualquier trabajador o todos
  if (workerId) {
    return NextResponse.json(await getWorkerBalance(workerId))
  }

  // Todos los trabajadores con su balance
  const workers = await prisma.worker.findMany({
    include: {
      payments: { orderBy: { paidAt: "desc" } },
      assignments: {
        where: { status: "SETTLED" },
        include: { settlement: true },
      },
    },
    orderBy: { name: "asc" },
  })

  const result = workers.map((w) => computeBalance(w))
  return NextResponse.json(result)
}

// POST /api/payments — registrar un pago (solo admin)
export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { workerId, amount, notes } = parsed.data

  const worker = await prisma.worker.findUnique({ where: { id: workerId } })
  if (!worker) return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 })

  const payment = await prisma.workerPayment.create({
    data: { workerId, amount, notes },
  })

  return NextResponse.json(payment, { status: 201 })
}

// Helpers

async function getWorkerBalance(workerId: string) {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      payments: { orderBy: { paidAt: "desc" } },
      assignments: {
        where: { status: "SETTLED" },
        include: { settlement: true },
      },
    },
  })
  if (!worker) return null
  return computeBalance(worker)
}

function computeBalance(worker: any) {
  // Ganancias del trabajador por comisión
  const totalEarned = worker.assignments.reduce((acc: number, a: any) => {
    if (!a.settlement) return acc
    const amountDue = Number(a.settlement.amountDue)
    if (worker.commissionType === "PERCENTAGE") {
      return acc + amountDue * (Number(worker.commission) / 100)
    } else {
      // FIXED: commission por unidad vendida
      return acc + (a.quantitySold ?? 0) * Number(worker.commission)
    }
  }, 0)

  const totalPaid = worker.payments.reduce(
    (acc: number, p: any) => acc + Number(p.amount),
    0
  )

  return {
    workerId: worker.id,
    workerName: worker.name,
    commissionType: worker.commissionType,
    commission: Number(worker.commission),
    totalEarned: Math.round(totalEarned * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    pendingBalance: Math.round((totalEarned - totalPaid) * 100) / 100,
    recentPayments: worker.payments.slice(0, 5),
  }
}
```

**Step 2: Verificar tipos**
```bash
npx tsc --noEmit
```

**Step 3: Probar la API manualmente**
```bash
# Desde el navegador o con curl (con sesión activa):
curl http://localhost:3000/api/payments -H "Cookie: ..."
```

**Step 4: Commit**
```bash
git add app/api/payments/route.ts
git commit -m "feat: API /api/payments para gestionar pagos a trabajadores"
```

---

## Task 4: UI Admin — Pagos por Trabajador en `workers-client.tsx`

**Files:**
- Modify: `components/admin/workers-client.tsx`

> Lee el archivo completo antes de modificar.

**Step 1: Agregar estado y query para balances**

Agregar import de `DollarSign` a los imports de lucide-react y `formatCurrency` a utils.

Agregar query de balances después de la query de workers:
```typescript
const { data: balances = [] } = useQuery({
  queryKey: ["worker-balances"],
  queryFn: async () => {
    const res = await fetch("/api/payments")
    if (!res.ok) return []
    return res.json()
  },
})

// Helper para obtener balance de un worker
const getBalance = (workerId: string) =>
  balances.find((b: any) => b.workerId === workerId)
```

**Step 2: Agregar estado para el dialog de pago**

Agregar junto a los otros `useState`:
```typescript
const [payingWorker, setPayingWorker] = useState<any>(null)
const [payAmount, setPayAmount] = useState("")
const [payNotes, setPayNotes] = useState("")
```

**Step 3: Agregar mutation para registrar pago**

Después de `deleteMutation`:
```typescript
const payMutation = useMutation({
  mutationFn: async ({ workerId, amount, notes }: { workerId: string; amount: number; notes: string }) => {
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId, amount, notes }),
    })
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error") }
    return res.json()
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["worker-balances"] })
    toast.success("Pago registrado")
    setPayingWorker(null)
    setPayAmount("")
    setPayNotes("")
  },
  onError: (e: any) => toast.error(e.message),
})
```

**Step 4: Agregar columna de balance y botón de pago a cada worker card**

En el JSX donde se muestra la comisión del trabajador, agregar el balance pendiente:
```tsx
{(() => {
  const bal = getBalance(worker.id)
  return bal ? (
    <p className="text-xs text-orange-600 font-medium">
      Pendiente: {formatCurrency(bal.pendingBalance)}
    </p>
  ) : null
})()}
```

Agregar botón "Registrar Pago" junto a los botones de editar/eliminar:
```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
  title="Registrar pago"
  onClick={() => {
    const bal = getBalance(worker.id)
    setPayingWorker({ ...worker, balance: bal })
    setPayAmount(bal ? String(bal.pendingBalance) : "")
    setPayNotes("")
  }}
>
  <DollarSign className="h-3.5 w-3.5" />
</Button>
```

**Step 5: Agregar Dialog de pago** (agregar fuera del `.map()`, al nivel del componente):
```tsx
<Dialog open={!!payingWorker} onOpenChange={(v) => { if (!v) setPayingWorker(null) }}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Registrar Pago — {payingWorker?.name}</DialogTitle>
    </DialogHeader>
    {payingWorker?.balance && (
      <div className="bg-orange-50 rounded-lg p-3 text-sm text-orange-800 space-y-1">
        <p>Total ganado: <strong>{formatCurrency(payingWorker.balance.totalEarned)}</strong></p>
        <p>Total pagado: <strong>{formatCurrency(payingWorker.balance.totalPaid)}</strong></p>
        <p className="text-base font-bold">
          Pendiente: {formatCurrency(payingWorker.balance.pendingBalance)}
        </p>
      </div>
    )}
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Monto a pagar (S/)</label>
        <Input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={payAmount}
          onChange={(e) => setPayAmount(e.target.value)}
          placeholder="0.00"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Notas (opcional)</label>
        <Input
          value={payNotes}
          onChange={(e) => setPayNotes(e.target.value)}
          placeholder="Pago semanal, etc."
          className="mt-1"
        />
      </div>
    </div>
    <div className="flex gap-2 justify-end">
      <Button variant="outline" onClick={() => setPayingWorker(null)}>Cancelar</Button>
      <Button
        className="bg-green-600 hover:bg-green-700"
        disabled={payMutation.isPending || !payAmount || Number(payAmount) <= 0}
        onClick={() => payMutation.mutate({
          workerId: payingWorker.id,
          amount: Number(payAmount),
          notes: payNotes,
        })}
      >
        {payMutation.isPending ? "Registrando..." : "Registrar Pago"}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

**Step 6: Verificar tipos**
```bash
npx tsc --noEmit
```

**Step 7: Commit**
```bash
git add components/admin/workers-client.tsx
git commit -m "feat: panel de pagos a trabajadores en la vista de admin"
```

---

## Task 5: UI Worker — Balance en Worker Home

**Files:**
- Modify: `app/(worker)/home/page.tsx`
- Modify: `components/worker/worker-home.tsx`

**Step 1: Pasar balance al worker home desde el server**

En `app/(worker)/home/page.tsx`, agregar fetch del balance:
```typescript
// Después de obtener assignments:
const balanceRes = await fetch(
  `${process.env.NEXTAUTH_URL}/api/payments?workerId=${session.user.workerId}`,
  { cache: 'no-store' }
).catch(() => null)
const balance = balanceRes?.ok ? await balanceRes.json() : null
```

> Nota: Alternativamente, llamar directamente a Prisma en la page (mismo patrón que usa con assignments). Es más directo:

```typescript
// Calcular balance directamente con Prisma en el server
const workerWithData = await prisma.worker.findUnique({
  where: { id: session.user.workerId! },
  include: {
    payments: true,
    assignments: {
      where: { status: "SETTLED" },
      include: { settlement: true },
    },
  },
})

let pendingBalance = 0
if (workerWithData) {
  const totalEarned = workerWithData.assignments.reduce((acc, a) => {
    if (!a.settlement) return acc
    const amountDue = Number(a.settlement.amountDue)
    return acc + (
      workerWithData.commissionType === "PERCENTAGE"
        ? amountDue * (Number(workerWithData.commission) / 100)
        : (a.quantitySold ?? 0) * Number(workerWithData.commission)
    )
  }, 0)
  const totalPaid = workerWithData.payments.reduce((acc, p) => acc + Number(p.amount), 0)
  pendingBalance = Math.round((totalEarned - totalPaid) * 100) / 100
}
```

Pasar como prop:
```tsx
return <WorkerHome
  assignments={serialize(assignments)}
  pendingBalance={pendingBalance}
/>
```

**Step 2: Actualizar `worker-home.tsx` para mostrar el balance**

Agregar `pendingBalance: number` a las props del componente.

Agregar una card de balance al inicio del JSX (antes de las assignments cards), usando la paleta de colores del proyecto:
```tsx
{pendingBalance > 0 && (
  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
    <div>
      <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Tu balance pendiente</p>
      <p className="text-2xl font-bold text-orange-700 mt-0.5">
        {formatCurrency(pendingBalance)}
      </p>
    </div>
    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
      <DollarSign className="h-5 w-5 text-orange-600" />
    </div>
  </div>
)}
{pendingBalance === 0 && (
  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
    <p className="text-sm text-green-700 font-medium">Sin pagos pendientes</p>
  </div>
)}
```

**Step 3: Verificar tipos**
```bash
npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add app/(worker)/home/page.tsx components/worker/worker-home.tsx
git commit -m "feat: mostrar balance pendiente de pago en home del trabajador"
```

---

## Task 6: Categorías de Producto — ProductDialog

**Files:**
- Modify: `components/admin/product-dialog.tsx`

> Lee el archivo completo antes de modificar.

**Step 1: Agregar campos al schema Zod del dialog**

Encontrar el schema de producto dentro de `product-dialog.tsx` y agregar:
```typescript
category: z.enum(["CONSERVA", "CHOCOLATE", "LECHE", "ARROZ", "OTRO"]).default("CONSERVA"),
isSpecial: z.boolean().default(false),
```

**Step 2: Actualizar el formulario con los nuevos campos**

Agregar un `Select` para `category` y un `Switch` (o `Checkbox`) para `isSpecial`.

Para el Select de categoría:
```tsx
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
```

Para el toggle de producto especial (usar un div simple con checkbox de shadcn):
```tsx
<FormField control={form.control} name="isSpecial" render={({ field }) => (
  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
    <div>
      <FormLabel>Producto especial</FormLabel>
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
```

**Step 3: Actualizar la API route de productos**

En `app/api/products/route.ts` (POST) y `app/api/products/[id]/route.ts` (PUT), agregar los campos al schema Zod y al `prisma.product.create/update`:

Schema additions:
```typescript
category: z.enum(["CONSERVA", "CHOCOLATE", "LECHE", "ARROZ", "OTRO"]).optional().default("CONSERVA"),
isSpecial: z.boolean().optional().default(false),
```

En create/update data:
```typescript
data: {
  ...existingFields,
  category: parsed.data.category,
  isSpecial: parsed.data.isSpecial,
}
```

**Step 4: Mostrar badge de categoría en companies-client.tsx**

En la tabla de productos de `companies-client.tsx`, después del nombre del producto, agregar:
```tsx
<TableCell className="font-medium">
  {product.name}
  {product.isSpecial && (
    <Badge className="ml-2 text-xs bg-orange-100 text-orange-700 border-orange-200">
      Especial
    </Badge>
  )}
  <Badge variant="outline" className="ml-1 text-xs text-gray-500">
    {product.category === "CONSERVA" ? "Conserva"
     : product.category === "CHOCOLATE" ? "Chocolate"
     : product.category === "LECHE" ? "Leche"
     : product.category === "ARROZ" ? "Arroz"
     : "Otro"}
  </Badge>
</TableCell>
```

**Step 5: Verificar tipos**
```bash
npx tsc --noEmit
```

**Step 6: Commit**
```bash
git add components/admin/product-dialog.tsx app/api/products/route.ts \
  app/api/products/[id]/route.ts components/admin/companies-client.tsx
git commit -m "feat: categorías de producto (CONSERVA/CHOCOLATE/LECHE/ARROZ/OTRO) y flag isSpecial"
```

---

## Task 7: Precios Irregulares — customSalePrice en Asignaciones

**Files:**
- Modify: `app/api/assignments/route.ts`
- Modify: `components/admin/assignments-client.tsx`
- Modify: `app/api/settlements/route.ts`
- Modify: `components/worker/settle-form.tsx`

### 7a. API de Asignaciones — aceptar customSalePrice

**Step 1: Actualizar el schema Zod en `app/api/assignments/route.ts`**

Dentro del schema de items, agregar:
```typescript
customSalePrice: z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().positive().nullable().optional()
),
```

En el `tx.assignment.create`, agregar:
```typescript
data: {
  ...existingFields,
  customSalePrice: item.customSalePrice ?? null,
}
```

### 7b. UI de Asignaciones — input de precio custom

**Step 2: Agregar input de precio en `assignments-client.tsx`**

> Lee el archivo completo antes de modificar.

Dentro del estado de items (donde se manejan `boxes` y `units` por producto), agregar `customSalePrice: ""`.

En el JSX de cada producto en el formulario de asignación, agregar después del BoxUnitStepper:
```tsx
<div className="mt-2">
  <label className="text-xs text-gray-500">
    Precio venta personalizado (dejar vacío para usar S/ {formatCurrency(product.salePrice)})
  </label>
  <Input
    type="text"
    inputMode="decimal"
    autoComplete="off"
    placeholder={`S/ ${formatCurrency(product.salePrice)}`}
    value={item.customSalePrice}
    onChange={(e) => updateItem(product.id, "customSalePrice", e.target.value)}
    className="h-8 text-sm mt-1"
  />
</div>
```

En el POST de asignaciones, incluir `customSalePrice` en el body:
```typescript
items: items.map(i => ({
  productId: i.productId,
  quantityAssigned: i.quantityAssigned,
  customSalePrice: i.customSalePrice ? Number(i.customSalePrice) : null,
}))
```

### 7c. API de Settlements — usar customSalePrice al calcular amountDue

**Step 3: Actualizar `app/api/settlements/route.ts`**

> Lee el archivo completo antes de modificar.

Al calcular `amountDue` en el POST de settlement, obtener el `assignment` con su `customSalePrice` y `product.salePrice`:

```typescript
// Obtener el assignment con customSalePrice y product
const assignment = await tx.assignment.findUnique({
  where: { id: assignmentId },
  include: { product: true },
})
if (!assignment) throw new Error(`Assignment ${assignmentId} no encontrado`)

// Precio efectivo: custom si existe, salePrice del producto si no
const effectiveSalePrice = assignment.customSalePrice ?? assignment.product.salePrice

// amountDue = totalSold × effectiveSalePrice
const amountDue = new Decimal(totalSold).mul(effectiveSalePrice)
```

> Nota: El proyecto ya usa `Decimal` de Prisma. Importar `import Decimal from "@prisma/client/runtime/library"` si es necesario, o convertir a `Number` y usar aritmética: `const amountDue = totalSold * Number(effectiveSalePrice)`.

### 7d. Mostrar precio efectivo en settle-form

**Step 4: Actualizar `components/worker/settle-form.tsx`**

En el resumen del producto en el paso de rendición, mostrar el precio real con el que se calculó:
```tsx
<p className="text-xs text-gray-500">
  Precio: {formatCurrency(item.assignment.customSalePrice ?? item.assignment.product.salePrice)}
  {item.assignment.customSalePrice && (
    <span className="ml-1 text-orange-500">(precio especial)</span>
  )}
</p>
```

Para que `settle-form.tsx` tenga acceso a `customSalePrice`, asegurarse de que `app/(worker)/settle/page.tsx` incluya `customSalePrice` en el `prisma.assignment.findMany()`.

**Step 5: Verificar tipos**
```bash
npx tsc --noEmit
```

**Step 6: Commit**
```bash
git add app/api/assignments/route.ts components/admin/assignments-client.tsx \
  app/api/settlements/route.ts components/worker/settle-form.tsx \
  app/(worker)/settle/page.tsx
git commit -m "feat: precios irregulares por asignación (customSalePrice)"
```

---

## Task 8: Actualizar Seed (opcional pero recomendado)

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Agregar ejemplos con categorías y precio custom**

En el seed, al crear productos de ejemplo, incluir los nuevos campos:
```typescript
// Productos conserva (default)
await prisma.product.create({
  data: { name: "Conserva de Atún", category: "CONSERVA", isSpecial: false, ... }
})

// Productos especiales
await prisma.product.create({
  data: { name: "Chocolates Sublime", category: "CHOCOLATE", isSpecial: true, ... }
})
```

**Step 2: Reset + seed**
```bash
cd /home/mapins/Escritorio/trazzio
npx prisma db push && npm run db:seed
```

**Step 3: Commit**
```bash
git add prisma/seed.ts
git commit -m "chore: actualizar seed con categorías y productos especiales de ejemplo"
```

---

## Task 9: Verificación Final

**Step 1: Build de producción completo**
```bash
cd /home/mapins/Escritorio/trazzio && npm run build
```
Expected: Build exitoso sin errores de tipos.

**Step 2: Pruebas manuales del checklist**

| Escenario | Resultado esperado |
|-----------|-------------------|
| Crear empresa → recargar | Empresa aparece sin F5 |
| Eliminar empresa → intentar eliminar de nuevo | Error claro "no encontrado", no error 500 |
| Worker home → ver balance pendiente | Muestra S/ X.XX si tiene comisiones no pagadas |
| Admin → workers → botón $ → registrar pago | Balance se actualiza a 0 (o lo que quede) |
| Crear producto con categoría CHOCOLATE + isSpecial | Badge naranja "Especial" + badge "Chocolate" visibles |
| Asignar con precio custom S/ 2.50 | Settlement calcula amountDue con 2.50, no el salePrice del producto |
| Worker settle → resumen muestra "precio especial" | Label naranja visible en items con precio custom |

**Step 3: Commit final si hay ajustes**
```bash
git add -A
git commit -m "fix: ajustes finales post-verificación"
```

---

## Resumen de Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `app/(admin)/*/page.tsx` (7 archivos) | `export const dynamic = 'force-dynamic'` |
| `app/(worker)/*/page.tsx` (2 archivos) | `export const dynamic = 'force-dynamic'` |
| `prisma/schema.prisma` | WorkerPayment model, ProductCategory enum, customSalePrice, isSpecial, category |
| `app/api/payments/route.ts` | Nuevo — GET (balance) + POST (registrar pago) |
| `app/api/products/route.ts` | Aceptar category + isSpecial |
| `app/api/products/[id]/route.ts` | Aceptar category + isSpecial en PUT |
| `app/api/assignments/route.ts` | Aceptar customSalePrice por item |
| `app/api/settlements/route.ts` | Usar customSalePrice al calcular amountDue |
| `components/admin/workers-client.tsx` | Balance + Dialog de pago por trabajador |
| `components/admin/companies-client.tsx` | Badges de categoría + isSpecial |
| `components/admin/product-dialog.tsx` | Campos category + isSpecial |
| `components/admin/assignments-client.tsx` | Input de precio custom por producto |
| `components/worker/worker-home.tsx` | Card de balance pendiente |
| `components/worker/settle-form.tsx` | Mostrar precio efectivo |
| `app/(worker)/home/page.tsx` | Calcular y pasar pendingBalance |
| `app/(worker)/settle/page.tsx` | Incluir customSalePrice en el fetch |
| `prisma/seed.ts` | Ejemplos con nuevas categorías |
