# Flujo Intuitivo Pendientes Completos Implementation Plan

**Goal:** Completar todos los pendientes del flujo intuitivo con lote persistido, auditoría explícita, validaciones robustas y hardening responsive/a11y sin romper compatibilidad actual.

**Architecture:** Se usará una estrategia incremental compatible: primero esquema y contratos con fallback legacy por fecha, luego transición de UI a `batchId` persistido, y por último endurecimiento de reglas y UX. Todo cambio se implementa con TDD en pasos cortos y commits frecuentes.

**Tech Stack:** Next.js App Router, TypeScript, Prisma v5, PostgreSQL, Tailwind + shadcn/ui, TanStack Query, Vitest + Testing Library.

---

## 0. Contexto ejecutable obligatorio (nueva sesion)

### 0.1 Archivos y rutas de trabajo

- Contexto base: `docs/CLAUDE.md`
- Pantallas admin: `components/admin/stock-client.tsx`, `components/admin/assignments-client.tsx`
- Pantallas worker: `app/(worker)/settle/page.tsx`, `components/worker/settle-form.tsx`
- Shared: `components/shared/product-search-combobox.tsx`, `components/shared/batch-group-card.tsx`, `components/shared/company-badge.tsx`
- API: `app/api/stock/route.ts`, `app/api/assignments/route.ts`, `app/api/assignments/[id]/route.ts`
- Dominio: `prisma/schema.prisma`, `lib/batch-grouping.ts`

### 0.2 Comandos base

```bash
npm test
npm run lint
npx tsc --noEmit
npx prisma db push && npm run db:seed
```

### 0.3 Contratos minimos esperados para UI (transicion)

```ts
type AssignmentUI = {
  id: string
  workerId: string
  status: "ACTIVE" | "CLOSED"
  auditStatus?: "PENDING" | "IN_REVIEW" | "AUDITED"
  startDate: string
  batchId?: string | null
  batch?: {
    id: string
    code: string
    status: "OPEN" | "CLOSED"
    openedAt: string
    closedAt?: string | null
  } | null
  remaining: number
  product: {
    id: string
    name: string
    code?: string | null
    aliases?: string[] | null
    company: { id: string; name: string }
    unitPerBox: number
    salePrice: number
    productType?: string
  }
}
```

### 0.4 Guardrails de implementacion

1. No romper compatibilidad con datos sin `batchId` durante fases 1-3.
2. Cualquier cambio de API debe tener test de regresion asociado.
3. No quitar fallback legacy hasta que la suite final y QA manual esten en PASS.
4. En UI no introducir patrones visuales ajenos al sistema actual.

### Task 1: Baseline y contrato de transición

**Files:**
- Modify: `docs/CLAUDE.md`
- Modify: `docs/plans/2026-02-27-flujo-intuitivo-pendientes-completos-design.md`

**Step 1: Documentar contrato de transición batch legacy/persistido**

Agregar sección breve de compatibilidad (`batchId` + fallback por fecha).

**Step 2: Verificar baseline completo**

Run: `npm test`
Expected: PASS (o registrar fallas preexistentes exactas).

**Step 3: Commit**

```bash
git add docs/CLAUDE.md docs/plans/2026-02-27-flujo-intuitivo-pendientes-completos-design.md
git commit -m "docs: definir contrato de transicion batch persistido y fallback legacy"
```

### Task 2: Prisma schema para lote persistido y auditoría

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Test: `tests/api/assignments-batch-progress.test.ts`

**Step 1: Write failing test**

Agregar caso que requiera `batchId` + `auditStatus` para transición de lote.

```ts
it("computes next batch from persisted batch and audit status", async () => {
  const state = await getBatchStateFromFixtures()
  expect(state.currentBatchClosed).toBe(true)
  expect(state.nextBatchEnabled).toBe(true)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/assignments-batch-progress.test.ts`
Expected: FAIL por campos/relaciones inexistentes.

**Step 3: Write minimal implementation**

- Crear modelo `Batch` con `status/openedAt/closedAt`.
- Agregar `batchId` en `Assignment` y `StockEntry`.
- Agregar `auditStatus` en `Assignment`.
- Agregar `code` y `aliases` en `Product`.
- Actualizar seed mínimo para nuevos campos.

Agregar enums sugeridos:

```prisma
enum BatchStatus {
  OPEN
  CLOSED
}

enum AuditStatus {
  PENDING
  IN_REVIEW
  AUDITED
}
```

**Step 4: Push schema + run test**

Run: `npx prisma db push && npm run db:seed`
Run: `npx vitest run tests/api/assignments-batch-progress.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts tests/api/assignments-batch-progress.test.ts
git commit -m "feat: agregar batch persistido, auditStatus y campos de busqueda de producto"
```

### Task 3: Lógica de agrupación y progreso por lote persistido

**Files:**
- Modify: `lib/batch-grouping.ts`
- Test: `tests/api/assignments-batch-progress.test.ts`

**Step 1: Write failing test**

```ts
it("falls back to startDate grouping when batchId is missing", () => {
  const result = getBatchProgress(legacyAssignments)
  expect(result.currentBatchClosed).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/assignments-batch-progress.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

- Priorizar cálculo por `batchId`/`batch.status`.
- Mantener fallback por `startDate` para datos legacy.
- Conservar salida `{ currentBatchClosed, nextBatchEnabled }`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/assignments-batch-progress.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/batch-grouping.ts tests/api/assignments-batch-progress.test.ts
git commit -m "feat: progreso de lotes por batch persistido con fallback legacy"
```

### Task 4: API de stock y assignments con batch persistido

**Files:**
- Modify: `app/api/stock/route.ts`
- Modify: `app/api/assignments/route.ts`
- Modify: `app/api/assignments/[id]/route.ts`
- Test: `tests/api/assignments-batch-progress.test.ts`

**Step 1: Write failing tests**

Cubrir:
- creación de asignación exige lote activo
- cierre actualiza estado de auditoría/lote
- fallback si assignment legacy no tiene `batchId`

**Step 2: Run tests to verify fail**

Run: `npx vitest run tests/api/assignments-batch-progress.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

- `POST /api/stock`: vincular ingresos al lote activo.
- `POST /api/assignments`: guardar `batchId`.
- `DELETE /api/assignments/[id]`: cerrar trazable y recalcular progreso de lote.

Contrato de respuesta recomendado en endpoints de asignaciones:

```ts
{
  id: string
  batchId: string | null
  batchCode?: string | null
  status: "ACTIVE" | "CLOSED"
  auditStatus: "PENDING" | "IN_REVIEW" | "AUDITED"
  nextBatchEnabled?: boolean
}
```

**Step 4: Run tests to verify pass**

Run: `npx vitest run tests/api/assignments-batch-progress.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/stock/route.ts app/api/assignments/route.ts app/api/assignments/[id]/route.ts tests/api/assignments-batch-progress.test.ts
git commit -m "feat: contratos api de stock/asignaciones con batch persistido"
```

### Task 5: Mercadería admin basada en Batch real

**Files:**
- Modify: `components/admin/stock-client.tsx`
- Modify: `components/shared/batch-group-card.tsx`
- Test: `tests/components/stock-client-batches.test.tsx`

**Step 1: Write failing test**

```tsx
it("renders persisted batch code and status in stock groups", () => {
  render(<StockClient initialProducts={products} initialEntries={entries} />)
  expect(screen.getByText(/LOTE-0001/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify fail**

Run: `npx vitest run tests/components/stock-client-batches.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**

- Agrupar por `entry.batchId` cuando exista.
- Mostrar `Batch.code` y estado.
- Mantener comportamiento colapsable actual.

**Step 4: Run test to verify pass**

Run: `npx vitest run tests/components/stock-client-batches.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/admin/stock-client.tsx components/shared/batch-group-card.tsx tests/components/stock-client-batches.test.tsx
git commit -m "feat: mercaderia agrupada por batch persistido"
```

### Task 6: Asignaciones admin con auditStatus visible

**Files:**
- Modify: `components/admin/assignments-client.tsx`
- Test: `tests/components/assignments-batch-worker-accordion.test.tsx`

**Step 1: Write failing test**

```tsx
it("shows audit status badges by worker and assignment", async () => {
  render(<AssignmentsClient initialWorkers={workers} initialProducts={products} initialAssignments={assignments} />)
  expect(screen.getByText(/AUDITADO/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify fail**

Run: `npx vitest run tests/components/assignments-batch-worker-accordion.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**

- Renderizar `auditStatus` con badge accesible.
- Mantener acordeones `Lote > Trabajador`.
- Mostrar resumen de progreso por lote.

**Step 4: Run test to verify pass**

Run: `npx vitest run tests/components/assignments-batch-worker-accordion.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/admin/assignments-client.tsx tests/components/assignments-batch-worker-accordion.test.tsx
git commit -m "feat: estado de auditoria visible en asignaciones"
```

### Task 7: Combobox avanzada por nombre/empresa/código/alias

**Files:**
- Modify: `components/shared/product-search-combobox.tsx`
- Modify: `tests/components/product-search-combobox.test.tsx`

**Step 1: Write failing test**

```tsx
it("searches by code and alias in addition to name and company", async () => {
  render(<ProductSearchCombobox products={fixtures} onSelect={onSelect} />)
  await userEvent.type(screen.getByRole("combobox"), "COD-101")
  expect(screen.getByText(/Leche Entera/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify fail**

Run: `npx vitest run tests/components/product-search-combobox.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**

- Filtro por `name`, `company`, `code`, `aliases`.
- Teclado completo y feedback de foco.
- Render-window en listas grandes (sin romper accesibilidad).

**Step 4: Run test to verify pass**

Run: `npx vitest run tests/components/product-search-combobox.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/shared/product-search-combobox.tsx tests/components/product-search-combobox.test.tsx
git commit -m "feat: combobox robusta con busqueda por codigo y alias"
```

### Task 8: Registro diario con validaciones inline y resumen global

**Files:**
- Modify: `components/worker/settle-form.tsx`
- Modify: `tests/components/settle-form.test.tsx`
- Modify: `tests/components/settle-form-submit.test.tsx`

**Step 1: Write failing tests**

- error inline por producto inválido
- resumen global de errores
- botón final bloqueado en submit

**Step 2: Run tests to verify fail**

Run: `npx vitest run tests/components/settle-form.test.tsx tests/components/settle-form-submit.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**

- Validaciones inline (`vendido + merma <= asignado`).
- Resumen global sticky.
- `Finalizar registro del día` con bloqueo de doble envío.

**Step 4: Run tests to verify pass**

Run: `npx vitest run tests/components/settle-form.test.tsx tests/components/settle-form-submit.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/worker/settle-form.tsx tests/components/settle-form.test.tsx tests/components/settle-form-submit.test.tsx
git commit -m "feat: validaciones inline y cierre robusto en registro diario"
```

### Task 9: Hardening responsive y accesibilidad

**Files:**
- Modify: `components/admin/stock-client.tsx`
- Modify: `components/admin/assignments-client.tsx`
- Modify: `components/worker/settle-form.tsx`
- Modify: `app/globals.css`
- Test: `tests/components/responsive-a11y-smoke.test.tsx`

**Step 1: Write failing test**

```tsx
it("keeps accessible controls and alert semantics", () => {
  render(<SettleForm assignments={assignments} />)
  expect(screen.getByRole("button", { name: /Finalizar registro del día/i })).toBeInTheDocument()
})
```

**Step 2: Run test to verify fail**

Run: `npx vitest run tests/components/responsive-a11y-smoke.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**

- `focus-visible:ring-2`, `motion-reduce:transition-none`.
- targets >=44px.
- evitar overflow horizontal mobile.

Checklist responsive obligatorio por vista:

- `stock-client`: no desbordar tablas/cards en 375.
- `assignments-client`: acordeones funcionales por teclado y tactil.
- `settle-form`: CTA visible con teclado abierto y sin tap targets menores a 44px.

**Step 4: Run test to verify pass**

Run: `npx vitest run tests/components/responsive-a11y-smoke.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/admin/stock-client.tsx components/admin/assignments-client.tsx components/worker/settle-form.tsx app/globals.css tests/components/responsive-a11y-smoke.test.tsx
git commit -m "fix: hardening responsive y accesibilidad del flujo operativo"
```

### Task 10: Verificación final y cierre

**Files:**
- Modify: `docs/plans/2026-02-27-flujo-intuitivo-pendientes-completos-implementation.md`

**Step 1: Run focused suite**

```bash
npx vitest run tests/components/stock-client-batches.test.tsx \
  tests/components/assignments-batch-worker-accordion.test.tsx \
  tests/components/product-search-combobox.test.tsx \
  tests/components/settle-form.test.tsx \
  tests/components/settle-form-submit.test.tsx \
  tests/components/responsive-a11y-smoke.test.tsx \
  tests/api/assignments-batch-progress.test.ts
```

Expected: PASS.

**Step 2: Run regression suite**

Run: `npm test`
Run: `npm run lint`
Run: `npx tsc --noEmit`
Expected: PASS.

**Step 3: QA manual checklist**

- [ ] 375px sin scroll horizontal.
- [ ] 768px mantiene jerarquía lote/trabajador.
- [ ] 1024px+ densidad legible.
- [ ] Búsqueda por código/alias funcional.
- [ ] Validaciones inline y resumen global claros.
- [ ] `Lote +1` solo tras cierre y auditoría completa.

**Step 4: Commit cierre**

```bash
git add docs/plans/2026-02-27-flujo-intuitivo-pendientes-completos-implementation.md
git commit -m "docs: plan de implementacion para cierre total de pendientes de flujo intuitivo"
```

## Riesgos y mitigaciones

1. Riesgo: datos legacy sin `batchId`.
Mitigación: fallback por fecha + tests duales.

2. Riesgo: regresión por transición de cierre de asignaciones.
Mitigación: tests API de cierre y progreso de lote.

3. Riesgo: combobox lenta en catálogos extensos.
Mitigación: render-window y límites de render por frame.

4. Riesgo: UI densa en mobile.
Mitigación: layout mobile-first con tarjetas y acordeones.

5. Riesgo: inconsistencias por datos historicos agrupados por fecha.
Mitigación: fixtures mixtas (persistido + legacy) en tests de API y UI.

## Definición de Done

1. Todas las tareas 1-10 con checks en PASS.
2. Flujo opera con lote persistido y fallback legacy en lectura.
3. Auditoría visible y consistente en admin.
4. Worker registra sin ambigüedad ni estados inválidos.
5. Responsive/a11y validados en 375/768/1024/1440.

## Handoff checklist para nueva sesion

1. Leer `docs/CLAUDE.md` y este plan completo antes de editar.
2. Ejecutar Task 1 y registrar baseline real.
3. Seguir tareas en orden; no saltar migraciones.
4. Mantener TDD por task (fail -> fix -> pass).
5. Al final de cada task, commit pequeño y verificable.
