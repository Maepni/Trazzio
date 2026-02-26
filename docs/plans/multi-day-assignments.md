# Plan: Asignaciones Multi-Día con Registro Diario

## Decision Log

| Decisión | Alternativas consideradas | Razón |
|---|---|---|
| Nuevo modelo `DailySale` | Reutilizar Settlement / AssignmentPeriod | Más limpio, semánticamente correcto |
| Asignaciones abiertas (sin fecha de fin) | Duración fija / mixto | Más flexible para el flujo real de trabajo |
| Merma reduce deuda Y stock físico | Solo informacional (como antes) | Refleja la realidad: el trabajador no responde por merma |
| Pagos parciales por producto | Global / ambos | Mayor trazabilidad y control por producto |
| Historial diario guardado | Solo acumulado | Trazabilidad total para auditoría |
| Worker ingresa `vendido` (no sobrante) | Mantener sobrante | Más intuitivo para trabajadores de campo |
| Una pantalla todos los productos | Paso a paso por producto | Más rápido para el trabajador |

---

## Resumen del Nuevo Flujo

1. **Admin crea asignación:** trabajador + empresa → cantidades por producto → asignación ACTIVE sin fecha de fin
2. **Worker registra cada día:** pantalla con todos sus productos → ingresa vendido + merma + pago por producto
3. **Cada registro → `DailySale`** con fecha, queda en historial
4. **Merma reduce:** stock físico del trabajador + monto que debe rendir
5. **Admin cierra asignación:** sobrante restante vuelve al stock → Assignment CLOSED
6. **Pagos parciales** quedan registrados aunque se cierre la asignación

## Reglas de Negocio

```
remaining   = quantityAssigned - Σ(quantitySold) - Σ(quantityMerma)
totalDue    = Σ(quantitySold) × product.salePrice
totalPaid   = Σ(amountPaid)
pendingDebt = totalDue - totalPaid
```

---

## Fase 1 — Schema Prisma

**Archivo:** `prisma/schema.prisma`

### Modificar `Assignment`
- Eliminar: `date`, `quantityReturned`, `quantitySold`
- Cambiar enum: `PENDING|SETTLED` → `ACTIVE|CLOSED`
- Añadir: `startDate DateTime @default(now())`
- Añadir relación: `dailySales DailySale[]`

### Añadir modelo `DailySale`
```prisma
model DailySale {
  id            String     @id @default(cuid())
  assignmentId  String
  date          DateTime   @default(now())
  quantitySold  Int
  quantityMerma Int        @default(0)
  amountPaid    Decimal    @default(0) @db.Decimal(10, 2)
  notes         String?
  assignment    Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
}
```

### Eliminar modelos
- `Settlement` (reemplazado por DailySale)
- `MermaItem` (absorbido en DailySale.quantityMerma)

### Enum
```prisma
enum AssignmentStatus { ACTIVE  CLOSED }
```

### Comandos
```bash
npx prisma db push
npm run db:seed
```

---

## Fase 2 — APIs: Assignments

**Archivo:** `app/api/assignments/route.ts`

### GET — Listar asignaciones activas
- Admin: todas las ACTIVE (con `?workerId=` opcional)
- Worker: sus asignaciones ACTIVE con totales calculados
- Incluir en respuesta: `remaining`, `totalDue`, `totalPaid`, `pendingDebt`
- Calcular desde `DailySale[]` incluidas con `include: { dailySales: true, product: true }`

### POST — Crear asignación (sin cambios de flujo)
- Igual que ahora: multi-producto, descuenta stock
- `status: ACTIVE` por defecto (era `PENDING`)
- Eliminar campo `date` (usar `startDate: new Date()`)

**Archivo:** `app/api/assignments/[id]/route.ts`

### DELETE — Cerrar asignación
```
1. Calcular remaining = quantityAssigned - Σ(sold) - Σ(merma)
2. Si remaining > 0 → product.stock += remaining (guard: no negativos)
3. Assignment.status = CLOSED (o delete directo)
4. Responder con stock restaurado para mostrar en confirmación
```

---

## Fase 3 — APIs: Daily Sales

**Archivo:** `app/api/daily-sales/route.ts`

### POST — Registrar día (batch)
```typescript
// Body: DailySaleItem[]
// Por cada item:
// 1. Verificar assignment.status === ACTIVE
// 2. Calcular remaining actual
// 3. Validar: quantitySold + quantityMerma <= remaining → 400 si supera
// 4. Crear DailySale
// Transacción atómica para el batch
```

### GET — Historial por asignación
```
?assignmentId=xxx → DailySale[] ordenadas por date DESC
```

---

## Fase 4 — UI Worker

### `app/(worker)/home/page.tsx` + worker-home component
- Reemplazar card de balance por **cards por producto** mostrando:
  - Nombre producto + empresa
  - Asignado / Vendido / Merma / Restante
  - Deuda total / Pagado / Saldo pendiente
- Botón global **"Registrar día"** → `/worker/settle`
- Si no hay asignaciones activas → mensaje vacío

### `app/(worker)/settle/page.tsx` + `components/worker/settle-form.tsx`
- Reemplazar flujo paso a paso por **lista de productos**
- Por cada producto activo:
  - Header: nombre + precio + restante actual
  - `BoxUnitStepper` para vendido (max: remaining)
  - `BoxUnitStepper` para merma (max: remaining - vendido)
  - Input numérico para pago
  - Input texto para notas
- Paso final: resumen general antes de confirmar
- Solo incluir en POST productos con vendido > 0 OR merma > 0 OR pago > 0
- Llamada a `POST /api/daily-sales`

---

## Fase 5 — UI Admin

### `app/(admin)/assignments/page.tsx` + `components/admin/assignments-client.tsx`
- Mantener formulario de creación (selector trabajador → empresa → productos)
- Reemplazar tabla/lista de asignaciones por vista agrupada por trabajador:
  - Por trabajador: tabla de productos con columnas Asignado/Vendido/Merma/Restante
  - Footer del grupo: deuda total, pagado, saldo pendiente
  - Botón **"Cerrar asignación"** con dialog de confirmación (muestra stock a restaurar)
  - Botón **"Ver historial"** → Sheet con DailySales del trabajador

### `app/(admin)/settlements/page.tsx` + `components/admin/settlements-client.tsx`
- Reproponer como **"Historial"**
- Mostrar asignaciones CLOSED filtrable por trabajador + rango de fechas
- Por asignación cerrada: resumen de totales finales
- Click → Sheet con detalle de DailySales

---

## Fase 6 — Reportes y Dashboard

### `app/api/reports/route.ts`
- Reemplazar queries sobre `Settlement` por queries sobre `DailySale`
- `totalSold` = `Σ(DailySale.quantitySold)`
- `totalMerma` = `Σ(DailySale.quantityMerma)`
- `totalRevenue` = `Σ(DailySale.quantitySold × assignment.product.salePrice)`
- `totalCollected` = `Σ(DailySale.amountPaid)`

### `app/(admin)/dashboard`
- KPIs del día = DailySales con `date` dentro del día actual
- Gráfico de barras por trabajador = `Σ vendido × precio` del día

---

## Orden de Implementación

```
1. Schema (Prisma) + seed
2. API assignments (GET + POST + DELETE)
3. API daily-sales (POST + GET)
4. Worker UI (home + settle-form)
5. Admin UI (assignments-client)
6. Admin UI (settlements → historial)
7. Reports + Dashboard
8. Pruebas end-to-end
```

---

## Archivos Modificados

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Assignment + DailySale + eliminar Settlement/MermaItem |
| `prisma/seed.ts` | Adaptar a nuevo schema |
| `app/api/assignments/route.ts` | GET con totales + POST sin date |
| `app/api/assignments/[id]/route.ts` | DELETE cierra y restaura stock |
| `app/api/daily-sales/route.ts` | NUEVO: POST batch + GET historial |
| `app/api/settlements/route.ts` | Eliminar o reproponer |
| `app/api/settlements/[id]/route.ts` | Eliminar |
| `app/api/reports/route.ts` | Adaptar a DailySale |
| `app/(admin)/assignments/page.tsx` | Pasar asignaciones activas con totales |
| `components/admin/assignments-client.tsx` | Vista agrupada + cerrar + historial |
| `app/(admin)/settlements/page.tsx` | Reproponer como historial |
| `components/admin/settlements-client.tsx` | Historial de asignaciones cerradas |
| `app/(worker)/home/page.tsx` | Cards por producto |
| `components/worker/worker-home.tsx` | Rediseño con productos activos |
| `app/(worker)/settle/page.tsx` | Pasar asignaciones activas |
| `components/worker/settle-form.tsx` | Lista todos los productos, un paso |
