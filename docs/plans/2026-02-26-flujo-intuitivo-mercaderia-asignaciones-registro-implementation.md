# Flujo Intuitivo (Mercadería, Asignaciones y Registro del Día) Implementation Plan

**Goal:** Implementar un flujo operativo intuitivo y consistente por lotes en Mercadería, Asignaciones y Registro del día, con búsqueda eficiente de productos, cálculos claros y cierre diario explícito.

**Architecture:** Mejora incremental sobre la base actual (Next.js + React Query + Prisma). Primero asegurar comportamiento con tests, luego implementación mínima para pasar, y finalmente hardening responsive/a11y. No se plantea rediseño total ni cambios de dominio innecesarios.

**Tech Stack:** Next.js App Router, React + TypeScript, Tailwind + shadcn/ui, TanStack Query, Prisma, Vitest, Testing Library.

---

## 0. Contexto obligatorio para nueva sesión

### 0.1 Decisiones de negocio ya aprobadas (no renegociar)

1. Asignaciones usa doble colapsable: `Lote > Trabajador`.
2. `Lote +1` se habilita automáticamente cuando el lote actual queda totalmente auditado/cerrado.
3. Registro del día del trabajador muestra solo productos del lote activo.
4. Botón final obligatorio y visible: `Finalizar registro del día`.
5. Enfoque UX incremental (sin rehacer toda la app).

### 0.2 Pantallas objetivo

- Admin:
  - `components/admin/stock-client.tsx`
  - `components/admin/assignments-client.tsx`
- Worker:
  - `components/worker/settle-form.tsx`
  - `app/(worker)/settle/page.tsx`
- Shared:
  - `components/shared/product-search-combobox.tsx`
  - `components/shared/batch-group-card.tsx`
  - `components/shared/company-badge.tsx`
- API/Domain:
  - `app/api/assignments/route.ts`
  - `app/api/assignments/[id]/route.ts`
  - `lib/batch-grouping.ts`

### 0.3 Reglas funcionales críticas

- Fórmula: `restante = asignado_inicial - vendido - merma`.
- Validación: `vendido + merma <= asignado_inicial`.
- Errores de validación deben bloquear envío y mostrarse inline + resumen.
- Doble submit en cierre diario debe bloquearse.

### 0.4 Requisitos UX/UI críticos

- Empresas distinguibles visualmente (badge estable, no solo color).
- Catálogo de 50+ productos: no usar dropdown largo, usar combobox buscable.
- Asignación de 20-25 productos: jerarquía clara y baja carga cognitiva.
- Lotes claramente separados y colapsables en Mercadería y Asignaciones.

### 0.5 Requisitos responsive

- Verificar 375 / 768 / 1024 / 1440.
- Mobile-first en layout y spacing.
- Touch targets >= 44px.
- Sin scroll horizontal en mobile.

---

## 1. Preflight técnico (antes de tocar código)

### Task 1: Verificar baseline y contratos actuales

**Files:**
- Read: `components/admin/stock-client.tsx`
- Read: `components/admin/assignments-client.tsx`
- Read: `components/worker/settle-form.tsx`
- Read: `lib/batch-grouping.ts`
- Read: `tests/components/settle-form.test.tsx`

**Step 1: Ejecutar baseline tests existentes**

Run: `npm test`
Expected: PASS (o registrar fallas previas explícitamente).

**Step 2: Documentar contratos JSON esperados (nota en PR o task log)**

Definir campos mínimos usados por UI:

```ts
// Assignment item minimum
{
  id: string
  workerId: string
  batchId?: string | null
  remaining: number
  product: {
    id: string
    name: string
    company: { id: string; name: string }
    salePrice: number
    unitPerBox: number
    productType?: string
  }
}
```

**Step 3: Commit (solo si se agrega documentación)**

```bash
git add <docs-if-any>
git commit -m "docs: baseline contracts for batch workflow"
```

---

## 2. Mercadería por lotes (colapsable + contexto)

### Task 2: Test de agrupación y colapso por lote

**Files:**
- Create: `tests/components/stock-client-batches.test.tsx`
- Modify: `components/admin/stock-client.tsx`

**Step 1: Write failing test**

```tsx
it("groups recent entries by lote and toggles detail", async () => {
  render(<StockClient initialProducts={products} initialEntries={entriesTwoBatches} />)

  expect(screen.getByText(/Lote 01/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: /Lote 01/i }))
  expect(screen.queryByText(/Producto Lote 01/i)).not.toBeInTheDocument()
})
```

**Step 2: Run**

Run: `npx vitest run tests/components/stock-client-batches.test.tsx`
Expected: FAIL.

**Step 3: Implement minimal**

- Usar `buildVisualBatches(entries)`.
- Renderizar lotes en bloques colapsables con `button` y `aria-expanded`.
- Mantener estado `collapsedBatches: Set<string>`.

**Step 4: Run again**

Run: `npx vitest run tests/components/stock-client-batches.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/components/stock-client-batches.test.tsx components/admin/stock-client.tsx
git commit -m "test+feat: lotes colapsables en mercaderia"
```

---

## 3. Combobox robusto para catálogo grande (50+)

### Task 3: Mejorar búsqueda y navegación por teclado

**Files:**
- Modify: `components/shared/product-search-combobox.tsx`
- Modify: `components/admin/stock-client.tsx`
- Modify: `components/admin/assignments-client.tsx`
- Modify: `tests/components/product-search-combobox.test.tsx`

**Step 1: Write/expand failing test**

```tsx
it("filters by product name, company and code with keyboard selection", async () => {
  render(<ProductSearchCombobox products={fixtures} onSelect={onSelect} />)

  await userEvent.type(screen.getByRole("combobox"), "empresa norte")
  expect(screen.getByText(/Producto A/i)).toBeInTheDocument()

  await userEvent.keyboard("{ArrowDown}{Enter}")
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: "Producto A" }))
})
```

**Step 2: Run**

Run: `npx vitest run tests/components/product-search-combobox.test.tsx`
Expected: FAIL.

**Step 3: Implement minimal**

- Match por `product.name`, `company.name`, `product.code` (si existe).
- Teclado: `ArrowUp/Down`, `Enter`, `Escape`.
- Render resultado con empresa, stock y unidad.
- Si lista >50, integrar virtualización (si ya hay util disponible; si no, limitar DOM renderizado en ventana visible).

**Step 4: Run again**

Run: `npx vitest run tests/components/product-search-combobox.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/shared/product-search-combobox.tsx components/admin/stock-client.tsx components/admin/assignments-client.tsx tests/components/product-search-combobox.test.tsx
git commit -m "test+feat: combobox de productos para catalogo grande"
```

---

## 4. Asignaciones con doble colapsable (Lote > Trabajador)

### Task 4: Estructura visual jerárquica + estado

**Files:**
- Create: `tests/components/assignments-batch-worker-accordion.test.tsx`
- Modify: `components/admin/assignments-client.tsx`
- Modify: `components/shared/batch-group-card.tsx`

**Step 1: Write failing test**

```tsx
it("renders nested accordions by lote then trabajador", async () => {
  render(<AssignmentsClient initialWorkers={workers} initialProducts={products} initialAssignments={assignments} />)

  await userEvent.click(screen.getByRole("button", { name: /Lote 01/i }))
  expect(screen.getByText(/Trabajador 1/i)).toBeInTheDocument()

  await userEvent.click(screen.getByRole("button", { name: /Trabajador 1/i }))
  expect(screen.getByText(/Producto asignado/i)).toBeInTheDocument()
})
```

**Step 2: Run**

Run: `npx vitest run tests/components/assignments-batch-worker-accordion.test.tsx`
Expected: FAIL.

**Step 3: Implement minimal**

- Agrupar por lote visual y luego por trabajador.
- Estado de colapso separado para lote y trabajador.
- Mostrar resumen de progreso por lote y por trabajador.

**Step 4: Run again**

Run: `npx vitest run tests/components/assignments-batch-worker-accordion.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/components/assignments-batch-worker-accordion.test.tsx components/admin/assignments-client.tsx components/shared/batch-group-card.tsx
git commit -m "test+feat: jerarquia lote-trabajador en asignaciones"
```

---

## 5. Regla de lote +1 por cierre completo

### Task 5: Validación de transición de lote en API

**Files:**
- Create: `tests/api/assignments-batch-progress.test.ts`
- Modify: `app/api/assignments/[id]/route.ts`
- Modify: `app/api/assignments/route.ts`
- Modify: `lib/batch-grouping.ts`

**Step 1: Write failing test**

```ts
it("enables next batch only when all workers from current batch are closed", async () => {
  const result = await closeAssignmentAndGetBatchState(fixtures)
  expect(result.currentBatchClosed).toBe(true)
  expect(result.nextBatchEnabled).toBe(true)
})
```

**Step 2: Run**

Run: `npx vitest run tests/api/assignments-batch-progress.test.ts`
Expected: FAIL.

**Step 3: Implement minimal**

- Recalcular estado del lote tras cada cierre de asignación.
- Si todos los trabajadores del lote quedan auditados/cerrados:
  - marcar lote cerrado
  - exponer señal `nextBatchEnabled = true`

**Step 4: Run again**

Run: `npx vitest run tests/api/assignments-batch-progress.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/api/assignments-batch-progress.test.ts app/api/assignments/[id]/route.ts app/api/assignments/route.ts lib/batch-grouping.ts
git commit -m "test+feat: avance automatico de lote al cierre completo"
```

---

## 6. Registro del día: lote activo + cálculos visibles

### Task 6: Filtrado por lote activo y restante en tiempo real

**Files:**
- Modify: `app/(worker)/settle/page.tsx`
- Modify: `components/worker/settle-form.tsx`
- Modify: `tests/components/settle-form.test.tsx`

**Step 1: Write/expand failing test**

```tsx
it("shows only active batch assignments and computes remaining", async () => {
  render(<SettleForm assignments={assignmentsFromTwoBatches} />)

  expect(screen.queryByText(/Producto Lote Viejo/i)).not.toBeInTheDocument()
  await userEvent.clear(screen.getByLabelText(/Vendido/i))
  await userEvent.type(screen.getByLabelText(/Vendido/i), "2")
  await userEvent.clear(screen.getByLabelText(/Merma/i))
  await userEvent.type(screen.getByLabelText(/Merma/i), "1")

  expect(screen.getByText(/Restante: 7/i)).toBeInTheDocument()
})
```

**Step 2: Run**

Run: `npx vitest run tests/components/settle-form.test.tsx`
Expected: FAIL.

**Step 3: Implement minimal**

- Filtrar assignments por lote activo.
- Mostrar `asignado`, `vendido`, `merma`, `restante` por producto.
- Fórmula de restante en UI.

**Step 4: Run again**

Run: `npx vitest run tests/components/settle-form.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/(worker)/settle/page.tsx components/worker/settle-form.tsx tests/components/settle-form.test.tsx
git commit -m "test+feat: registro diario centrado en lote activo"
```

---

## 7. Cierre explícito del registro diario

### Task 7: CTA final y prevención de doble envío

**Files:**
- Create: `tests/components/settle-form-submit.test.tsx`
- Modify: `components/worker/settle-form.tsx`

**Step 1: Write failing test**

```tsx
it("shows explicit finalize CTA and disables during submit", async () => {
  render(<SettleForm assignments={assignments} />)

  const btn = screen.getByRole("button", { name: /Finalizar registro del dia/i })
  expect(btn).toBeInTheDocument()

  await userEvent.click(btn)
  expect(btn).toBeDisabled()
})
```

**Step 2: Run**

Run: `npx vitest run tests/components/settle-form-submit.test.tsx`
Expected: FAIL.

**Step 3: Implement minimal**

- Mantener paso de confirmación.
- CTA explícita `Finalizar registro del día`.
- Estado loading + disabled para impedir doble submit.

**Step 4: Run again**

Run: `npx vitest run tests/components/settle-form-submit.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/components/settle-form-submit.test.tsx components/worker/settle-form.tsx
git commit -m "test+feat: cierre explicito y seguro del registro diario"
```

---

## 8. Hardening responsive y accesibilidad

### Task 8: Ajustes cross-screen + a11y mínima

**Files:**
- Create: `tests/components/responsive-a11y-smoke.test.tsx`
- Modify: `components/admin/stock-client.tsx`
- Modify: `components/admin/assignments-client.tsx`
- Modify: `components/worker/settle-form.tsx`
- Modify: `app/globals.css`

**Step 1: Write failing test**

```tsx
it("has labels, keyboard-ready controls and alert semantics", () => {
  render(<SettleForm assignments={assignments} />)

  expect(screen.getByLabelText(/Vendido/i)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /Lote 01/i })).toHaveAttribute("aria-expanded")
})
```

**Step 2: Run**

Run: `npx vitest run tests/components/responsive-a11y-smoke.test.tsx`
Expected: FAIL.

**Step 3: Implement minimal**

- Labels reales en inputs.
- Errores con `role="alert"` o `aria-live`.
- Botones colapsables con `aria-expanded`.
- Spacing responsive (`px-4 sm:px-6 lg:px-8`).
- Revisar overflow horizontal en mobile.

**Step 4: Run again**

Run: `npx vitest run tests/components/responsive-a11y-smoke.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/components/responsive-a11y-smoke.test.tsx components/admin/stock-client.tsx components/admin/assignments-client.tsx components/worker/settle-form.tsx app/globals.css
git commit -m "test+fix: hardening responsive y accesibilidad en flujo operativo"
```

---

## 9. Verificación final de release

### Task 9: QA técnico + QA funcional manual

**Files:**
- Modify: `docs/plans/2026-02-26-flujo-intuitivo-mercaderia-asignaciones-registro-implementation.md` (checklist final)

**Step 1: Focused suite**

```bash
npx vitest run tests/components/product-search-combobox.test.tsx \
  tests/components/settle-form.test.tsx \
  tests/components/stock-client-batches.test.tsx \
  tests/components/assignments-batch-worker-accordion.test.tsx \
  tests/components/settle-form-submit.test.tsx \
  tests/components/responsive-a11y-smoke.test.tsx \
  tests/api/assignments-batch-progress.test.ts
```

Expected: PASS.

**Step 2: Regression suite**

Run: `npm test`
Expected: PASS.

**Step 3: Manual checklist**

- [ ] 375px sin scroll horizontal.
- [ ] 768px mantiene jerarquía lote/trabajador.
- [ ] 1024px+ mantiene densidad legible.
- [ ] Combobox usable con teclado.
- [ ] `Finalizar registro del día` siempre visible en flujo final.
- [ ] Fórmula restante correcta en todos los casos.
- [ ] `Lote +1` solo tras cierre completo del lote.

**Step 4: Commit cierre**

```bash
git add docs/plans/2026-02-26-flujo-intuitivo-mercaderia-asignaciones-registro-implementation.md
git commit -m "docs: cierre de verificacion plan flujo intuitivo"
```

---

## 10. Riesgos y mitigaciones (para la nueva sesión)

1. Riesgo: inconsistencias entre lote visual y lote persistido.
Mitigación: test API dedicado + fixtures con múltiples lotes.

2. Riesgo: regresión en asignaciones existentes.
Mitigación: no romper contrato de campos actuales; añadir tests sobre render con datos viejos sin `batchId` explícito.

3. Riesgo: combobox pesado en catálogos largos.
Mitigación: virtualización/render window + debounce corto.

4. Riesgo: UX confusa en mobile.
Mitigación: acordeones por defecto y CTA sticky con hit area amplia.

## 11. Definición de Done global

Se considera completado cuando:

1. Todas las tareas 1-9 están en PASS.
2. No hay regresiones en tests existentes.
3. Flujo completo puede ejecutarse sin ambigüedad: Mercadería -> Asignaciones -> Registro del día.
4. Validaciones bloquean estados inválidos.
5. Responsive y a11y mínima verificados en 4 breakpoints.
