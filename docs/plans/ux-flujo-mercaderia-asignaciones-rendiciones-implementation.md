# UX Flujo Mercadería/Asignaciones/Rendiciones Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminar Reportes y mejorar UX operativa con búsqueda rápida de productos, lotes visuales numerados, identificación clara de empresa y rendición diaria más intuitiva.

**Architecture:** Se mantendrá la arquitectura Next.js App Router con componentes cliente reutilizables (`ProductSearchCombobox`, `BatchGroupCard`, `CompanyBadge`) y se extenderán vistas actuales sin reescribir dominio. Los lotes serán agrupaciones visuales derivadas de datos existentes (fecha/transacción) para minimizar cambios backend.

**Tech Stack:** Next.js 14, React 18, TypeScript, shadcn/ui, TanStack Query, Prisma, NextAuth, Vitest + Testing Library.

---

### Task 1: Base de pruebas (TDD)

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `tests/components/company-badge.test.tsx`
- Modify: `package.json`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import { CompanyBadge } from "@/components/shared/company-badge"

test("renders company name and aria label", () => {
  render(<CompanyBadge companyName="Nestle" colorKey="nestle" />)
  expect(screen.getByText("Nestle")).toBeInTheDocument()
  expect(screen.getByLabelText("Empresa Nestle")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/components/company-badge.test.tsx`  
Expected: FAIL (`Cannot find module` o componente no existe).

**Step 3: Write minimal implementation**

- Configurar Vitest + jsdom + setup con `@testing-library/jest-dom`.
- Agregar script: `"test": "vitest run"`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/components/company-badge.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json vitest.config.ts vitest.setup.ts tests/components/company-badge.test.tsx
git commit -m "test: setup vitest baseline for ui components"
```

### Task 2: Eliminar Reportes de navegación y rutas

**Files:**
- Modify: `components/admin/admin-sidebar.tsx`
- Modify: `components/admin/mobile-nav.tsx`
- Delete: `app/(admin)/reports/page.tsx`
- Delete: `components/admin/reports-client.tsx`
- Modify: `app/(admin)/layout.tsx` (si hay referencias directas)

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"

test("does not render Reportes nav item", () => {
  render(<AdminSidebar />)
  expect(screen.queryByText("Reportes")).not.toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/components/admin-sidebar.test.tsx`  
Expected: FAIL (Reportes visible).

**Step 3: Write minimal implementation**

- Quitar `Reportes` del array de navegación.
- Eliminar archivos/ruta de reportes.
- Verificar que no queden links a `/reports`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/components/admin-sidebar.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/admin/admin-sidebar.tsx components/admin/mobile-nav.tsx app/(admin)/reports/page.tsx components/admin/reports-client.tsx app/(admin)/layout.tsx tests/components/admin-sidebar.test.tsx
git commit -m "feat: remove reports module from navigation and routes"
```

### Task 3: CompanyBadge reutilizable con color accesible

**Files:**
- Create: `components/shared/company-badge.tsx`
- Create: `lib/company-colors.ts`
- Modify: `components/admin/stock-client.tsx`
- Modify: `components/admin/assignments-client.tsx`
- Modify: `components/worker/settle-form.tsx`

**Step 1: Write the failing test**

```tsx
test("shows text + non-color indicator", () => {
  render(<CompanyBadge companyName="Alicorp" colorKey="alicorp" />)
  expect(screen.getByText("Alicorp")).toBeVisible()
  expect(screen.getByText("EMP")).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/components/company-badge.test.tsx`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```tsx
export function CompanyBadge({ companyName, colorKey }: { companyName: string; colorKey: string }) {
  return (
    <span aria-label={`Empresa ${companyName}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getCompanyColorClass(colorKey)}`}>
      <span className="font-semibold">EMP</span>
      <span>{companyName}</span>
    </span>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/components/company-badge.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/shared/company-badge.tsx lib/company-colors.ts components/admin/stock-client.tsx components/admin/assignments-client.tsx components/worker/settle-form.tsx tests/components/company-badge.test.tsx
git commit -m "feat: add accessible company badge across operational views"
```

### Task 4: ProductSearchCombobox para catálogos grandes

**Files:**
- Create: `components/shared/product-search-combobox.tsx`
- Create: `tests/components/product-search-combobox.test.tsx`
- Modify: `components/admin/stock-client.tsx`

**Step 1: Write the failing test**

```tsx
test("filters products by name and company", async () => {
  render(<ProductSearchCombobox products={[{ id: "1", name: "Leche Gloria", company: { name: "Nestle" }, stock: 12 }]} onSelect={() => {}} />)
  await userEvent.type(screen.getByPlaceholderText(/buscar producto o empresa/i), "nest")
  expect(screen.getByText("Leche Gloria")).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/components/product-search-combobox.test.tsx`  
Expected: FAIL.

**Step 3: Write minimal implementation**

- Implementar input + lista filtrada + teclado (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`).
- Mostrar estado sin resultados con mensaje útil.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/components/product-search-combobox.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/shared/product-search-combobox.tsx components/admin/stock-client.tsx tests/components/product-search-combobox.test.tsx
git commit -m "feat: add realtime product search combobox for stock flows"
```

### Task 5: Ajuste/Quitar stock con razón opcional siempre visible

**Files:**
- Modify: `components/admin/stock-client.tsx`
- Modify: `app/api/stock/route.ts`
- Create: `tests/api/stock-reason-optional.test.ts`

**Step 1: Write the failing test**

```ts
test("accepts stock adjustment without reason", async () => {
  const payload = { productId: "p1", quantity: -3, notes: "" }
  const res = await postStock(payload)
  expect(res.status).toBe(200)
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/api/stock-reason-optional.test.ts`  
Expected: FAIL por validación de nota no opcional o UI no envia payload esperado.

**Step 3: Write minimal implementation**

- Campo razón siempre renderizado.
- En API, tratar `notes` vacío como `undefined`, sin bloquear operación.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/api/stock-reason-optional.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/admin/stock-client.tsx app/api/stock/route.ts tests/api/stock-reason-optional.test.ts
git commit -m "feat: keep stock reason optional and always visible"
```

### Task 6: Lotes visuales numerados en Mercadería y Asignaciones

**Files:**
- Create: `components/shared/batch-group-card.tsx`
- Create: `lib/batch-grouping.ts`
- Create: `tests/lib/batch-grouping.test.ts`
- Modify: `components/admin/stock-client.tsx`
- Modify: `components/admin/assignments-client.tsx`

**Step 1: Write the failing test**

```ts
import { buildVisualBatches } from "@/lib/batch-grouping"

test("assigns sequential labels Lote #1, #2", () => {
  const batches = buildVisualBatches([
    { id: "a", createdAt: "2026-02-26T10:00:00Z" },
    { id: "b", createdAt: "2026-02-26T09:00:00Z" },
  ])
  expect(batches[0].label).toBe("Lote #1")
  expect(batches[1].label).toBe("Lote #2")
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/lib/batch-grouping.test.ts`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
export function buildVisualBatches<T extends { createdAt: string }>(items: T[]) {
  return [...items]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .map((item, index) => ({ ...item, label: `Lote #${index + 1}` }))
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/lib/batch-grouping.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/shared/batch-group-card.tsx lib/batch-grouping.ts components/admin/stock-client.tsx components/admin/assignments-client.tsx tests/lib/batch-grouping.test.ts
git commit -m "feat: add visual batch grouping with sequential labels"
```

### Task 7: Rendición del trabajador con campos explícitos y cierre claro

**Files:**
- Modify: `components/worker/settle-form.tsx`
- Create: `tests/components/settle-form.test.tsx`

**Step 1: Write the failing test**

```tsx
test("shows assigned initial and finalize button", () => {
  render(<SettleForm assignments={[mockAssignment]} />)
  expect(screen.getByText(/asignado:/i)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /finalizar registro del día/i })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/components/settle-form.test.tsx`  
Expected: FAIL (copy/estructura actual distinta).

**Step 3: Write minimal implementation**

- Ajustar labels para mostrar `Asignado inicial`, `Restante calculado`, etc.
- Renombrar CTA principal a `Finalizar registro del día`.
- Mantener confirmación previa.

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/components/settle-form.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add components/worker/settle-form.tsx tests/components/settle-form.test.tsx
git commit -m "feat: improve worker daily settlement clarity and finalize action"
```

### Task 8: Verificación final y documentación

**Files:**
- Modify: `docs/especificaciones.md`
- Modify: `README.md` (solo si lista módulos incluye Reportes)

**Step 1: Write the failing test**

- Preparar checklist manual fallido inicial:
- Navegación aún muestra Reportes.
- Búsqueda en 50 productos tarda/confunde.
- No hay lote visual en listados.

**Step 2: Run test to verify it fails**

Run:
- `npm run lint`
- `npm run build`

Expected: sin errores críticos de compilación; checklist manual aún con puntos fallidos antes del merge final.

**Step 3: Write minimal implementation**

- Resolver hallazgos de lint/build.
- Actualizar docs funcionales del sistema sin tab Reportes.

**Step 4: Run test to verify it passes**

Run:
- `npm run test`
- `npm run lint`
- `npm run build`

Expected: PASS técnico + checklist manual validado en desktop/móvil.

**Step 5: Commit**

```bash
git add docs/especificaciones.md README.md
git commit -m "docs: update module map after reports removal and ux improvements"
```

