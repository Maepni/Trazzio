# CLAUDE.md — Contexto del Proyecto Trazzio

## Resumen
Sistema web fullstack para gestionar ventas de conservas. Ciclo: recepción de mercadería → asignación a trabajadores → registro diario de ventas/merma → cierre de asignación.

- **Dos roles:** Admin (desktop/mobile) y Trabajador (mobile-first)
- **Directorio:** `/home/mapins/Escritorio/trazzio/`
- **Docs:** `/home/mapins/Escritorio/trazzio/docs/`
- **Estado:** ✅ Todos los módulos implementados y funcionales

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js App Router + TypeScript | 14.2.35 |
| Base de datos | PostgreSQL | local |
| ORM | Prisma | v5.22 ⚠️ (NO usar v7) |
| Auth | NextAuth.js | v5 beta |
| UI | Tailwind CSS + shadcn/ui | Tailwind 3.x |
| Estado/Fetch | TanStack Query | v5 |
| Forms | react-hook-form + zod | RHF v7, Zod v4 (solo admin) |
| Gráficos | Recharts | instalado |

---

## Arquitectura de Rutas

```
app/
├── (auth)/login
├── (admin)/
│   ├── dashboard       → KPIs del día + gráfico barras trabajadores
│   ├── companies       → CRUD empresas y productos (con categorías e isSpecial)
│   ├── stock           → Recepción de mercadería + historial + inventario
│   ├── workers         → CRUD trabajadores + credenciales + gestión de pagos
│   ├── assignments     → Asignaciones activas (multi-producto, agrupadas por trabajador)
│   └── settlements     → Rendiciones: historial (un card por trabajador, Sheet con detalles)
├── (worker)/
│   ├── home            → Asignaciones del día + balance pendiente (SSR)
│   └── settle          → Rendición paso a paso con BoxUnitStepper
└── api/
    ├── auth/[...nextauth]
    ├── companies/[id]      GET, POST, PUT, DELETE
    ├── products/[id]       GET, POST, PUT, DELETE
    ├── workers/[id]        GET, POST, PUT, DELETE
    ├── stock               GET, POST
    ├── assignments/        GET (admin: ACTIVE+CLOSED+AUDITED; worker: solo ACTIVE), POST
    ├── assignments/audit   POST { workerId, batchDay } → cierra ACTIVE del trabajador en ese día, devuelve remaining al stock, marca AUDITED
    ├── assignments/[id]    DELETE (cierra asignación individual, restaura remaining al stock)
    ├── daily-sales/        GET (?assignmentId=xxx), POST (batch)
    ├── settlements/        GET (historial CLOSED)
    └── payments/           GET (balance trabajador), POST (registrar pago)
```

---

## Modelo de Datos (Prisma)

```
User           id, username, password, role(ADMIN|WORKER)
Worker         id, name, phone, commission(Decimal), commissionType(PERCENTAGE|FIXED), userId
Company        id, name
Product        id, name, code?, aliases[], companyId, costPrice(Decimal), salePrice(Decimal),
               unitPerBox, lowStockAlert, stock,
               productType(ProductType)             ← ESTANDAR|LECHE|ARROZ
Batch          id, code(UNIQUE), status(BatchStatus), openedAt, closedAt?,
               notes?                               ← lote persistido de mercadería/asignaciones
Assignment     id, workerId, productId, startDate, quantityAssigned,
               status(ACTIVE|CLOSED), auditStatus(AuditStatus), batchId?
DailySale      id, assignmentId, date, quantitySold, quantityMerma,
               amountPaid(Decimal), notes           ← registro diario del trabajador
StockEntry     id, productId, quantity, boxes, entryDate, notes, batchId?
WorkerPayment  id, workerId, amount(Decimal), paidAt(DateTime), notes

enum ProductType    { ESTANDAR | LECHE | ARROZ }   ← controla labels (Cajas/Bolsas/Costales)
enum AssignmentStatus { ACTIVE | CLOSED }
enum BatchStatus    { OPEN | CLOSED }
enum AuditStatus    { PENDING | IN_REVIEW | AUDITED }
```

**Regla central:**
- El trabajador registra `quantitySold` + `quantityMerma` cada día vía `DailySale`
- `remaining = quantityAssigned - sum(dailySales.quantitySold) - sum(dailySales.quantityMerma)`
- Merma reduce el `remaining` (y el stock físico del trabajador); el admin cierra la asignación y restaura el `remaining` al stock
- **Balance trabajador:** `pendingBalance = totalEarned - totalPaid` (clampeado a 0)
  - `totalEarned`: PERCENTAGE → `sum(DailySale.quantitySold × salePrice × commission/100)`; FIXED → `sum(quantitySold × commission)`
  - `totalPaid`: suma de `WorkerPayment.amount`

---

## Variables de Entorno (.env)

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trazzio?schema=public"
NEXTAUTH_SECRET="trazzio-super-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

---

## Comandos de Desarrollo

```bash
cd /home/mapins/Escritorio/trazzio
npm run dev                             # servidor de desarrollo
npm test                               # vitest
npm run lint                           # ESLint
npm run build                          # build de producción
npx prisma db push && npm run db:seed  # reset + recrear tablas + seed
npx tsc --noEmit                       # verificar tipos
rm -rf .next                           # limpiar caché (tras borrar rutas)
```

> ⚠️ `prisma migrate reset` borra las tablas pero NO las recrea (el proyecto usa `db push`, no migraciones). Siempre seguir con `npx prisma db push && npm run db:seed`.

Seed crea: `admin / admin123` (ADMIN) y `trabajador / worker123` (WORKER)

---

## Comportamiento Actual de los Módulos

### Stock (Recepción de Mercadería)
- **Flujo:** Seleccionar empresa → aparecen todos sus productos → ingresar **Cajas + Unidades** por separado (aditivo: total = cajas × unitPerBox + unidades)
- Submit crea una `StockEntry` por producto con qty > 0 (múltiples POST en serie)
- **Búsqueda de inventario:** Input simple (no combobox) que filtra en tiempo real por nombre de producto O nombre de empresa. Botón X para limpiar. Cada empresa tiene **borde izquierdo coloreado** único (via `getCompanyBorderClass` de `lib/company-colors.ts`)

### Asignaciones
- **Flujo:** Seleccionar trabajador → seleccionar empresa → aparecen todos sus productos con stock > 0 → ingresar Cajas + Unidades por producto
- Solo productos con qty > 0 se incluyen en el POST
- La tabla muestra asignaciones en **acordeón doble: Lote (por fecha de startDate) > Trabajador**. Estado: `expandedBatches`/`expandedWorkers` (Set vacío = todos colapsados). El GET devuelve ACTIVE **y** CLOSED+AUDITED para el admin.
- Filas AUDITED aparecen con fondo verde suave, opacidad reducida y badge "✓ Auditado"; sin botón de cierre.
- **Badge de auditoría** en header del trabajador: "Auditado" (verde, solo si TODOS sus items están CLOSED+AUDITED), "En revisión" (amarillo), "Pendiente" (gris).
- **Botón "Auditar"** en footer del trabajador expandido (solo si tiene asignaciones ACTIVE): llama a `POST /api/assignments/audit` → cierra todas sus ACTIVE en ese lote, devuelve `remaining` al stock, marca `auditStatus=AUDITED`. Las filas permanecen visibles como auditadas.
- Admin puede cerrar una asignación individualmente (DELETE) → restaura el `remaining` al stock y la elimina del registro.
- Historial diario por asignación: Sheet con tabla de `DailySale` registros

### Rendición del Trabajador (`settle-form.tsx`)
- **Estado local** (no RHF): `useState<ItemState[]>` por producto
- **Filtro de lote activo:** `getActiveBatch(assignments)` (helper interno) filtra las asignaciones al `startDate` más reciente. Si no hay `startDate`, muestra todas.
- El worker ingresa por producto: `quantitySold` (BoxUnitStepper), `quantityMerma` (Stepper simple), `amountPaid` (input decimal)
- **Restante en tiempo real:** se muestra como `Restante: {remaining - quantitySold - quantityMerma}u` en la card de cada producto
- Solo items con algún movimiento (vendido > 0, merma > 0 o pago > 0) se incluyen en el POST
- Submit: `POST /api/daily-sales` con array de items → crea un `DailySale` por item
- CTA: **"Finalizar registro del día"** (paso 1 → confirmación; paso 2 → mismo label, `disabled` durante envío para evitar doble submit)
- **Error inline visible:** estado `formError` + `<div role="alert">` en DOM cuando validación falla (sin movimiento o vendido+merma > remaining). Complementa el toast y es testeable con `screen.getByRole("alert")`.

### Rendiciones Admin (`settlements-client.tsx`)
- Muestra asignaciones `CLOSED` (historial) agrupadas por trabajador
- **Un card por trabajador**: muestra total vendido y deuda pendiente; trabajadores con deuda aparecen primero
- Al hacer clic: Sheet con resumen global (cobrado/pagado/pendiente) y lista de todas sus asignaciones cerradas, cada una con su producto, empresa, totales y tabla de registros diarios (`DailySale`)

### Pagos a Trabajadores
- **Admin → Workers:** cada card de trabajador muestra balance pendiente (naranja) y botón `$`
- **Dialog de pago:** muestra totalEarned / totalPaid / pendingBalance + input de monto + notas
- **Worker home:** card naranja "Tu balance pendiente: S/ X.XX" (verde si = 0)
- **API:** `GET /api/payments?workerId=xxx` → balance; `POST /api/payments` → registrar pago

### Productos (Companies)
- **ProductType:** enum `ESTANDAR|LECHE|ARROZ` controla los labels de unidades (Cajas/Bolsas/Costales)
- `lib/product-types.ts` → `getProductLabels(productType)` devuelve `container/unit/containerShort/unitShort/containerPer`

### Componentes Compartidos (`components/shared/`)
- **`CompanyBadge`**: badge accesible con `aria-label`, prefix "EMP" y color hash deterministico (`lib/company-colors.ts`)
- **`ProductSearchCombobox`**: input con `role="combobox"` + `aria-haspopup` + `aria-expanded`; filtrado por nombre, empresa, `code` y `aliases`; navegación teclado (↑↓ Enter Esc); guardia `typeof item?.scrollIntoView === "function"` para compatibilidad con jsdom
- **`BatchGroupCard`**: card **colapsable** (`defaultOpen=true` por defecto) con header `<button>` y `aria-expanded`; prop `extra` para contenido adicional en header
- `buildVisualBatches<T>(items)` en `lib/batch-grouping.ts` — ordena por `createdAt` desc y etiqueta secuencialmente
- `getBatchProgress(assignments)` en `lib/batch-grouping.ts` → `{ currentBatchClosed, nextBatchEnabled }` — prioriza `batchId`/`batch.status` cuando está disponible; fallback por `startDate` para datos legacy

---

## Convenciones de Código

### Patrón SSR → Client
```typescript
// page.tsx (Server Component)
import { serialize } from "@/lib/utils"   // ← SIEMPRE serializar
export const dynamic = 'force-dynamic'    // ← OBLIGATORIO en todas las pages con datos dinámicos
const data = await prisma.model.findMany(...)
return <ComponentClient initialData={serialize(data)} />

// component-client.tsx
"use client"
const { data } = useQuery({ queryKey: [...], queryFn: ..., initialData })
```

> **⚠️ CRÍTICO:** Prisma devuelve `Decimal`, `Date`, `BigInt` no serializables. Siempre `serialize()` antes de pasar datos a Client Components.

> **⚠️ CRÍTICO (producción):** Sin `export const dynamic = 'force-dynamic'`, Next.js renderiza las pages en build time (SSG). Los datos creados después del build NO aparecen. TODAS las pages con `prisma.findMany()` deben tener esta directiva.

### Formularios Admin (Zod v4 + RHF v7)
```typescript
// z.coerce.number() da tipo unknown → usar preprocess
const schema = z.object({
  price: z.preprocess((v) => Number(v), z.number()),
})
resolver: zodResolver(schema) as Resolver<FormData>  // o "as any"
```

### Inputs Numéricos
- `Input` de shadcn (`components/ui/input.tsx`) previene scroll accidental: `onWheel → blur` automático para `type="number"`
- Flechitas de spin eliminadas globalmente con `[appearance:textfield]`
- Precios (`costPrice`, `salePrice`): usar `type="text"` + `inputMode="decimal"` + `autoComplete="off"` para evitar el bug del "." y el autocomplete del browser
- Enteros: `type="text"` + `inputMode="numeric"` + `autoComplete="off"`

### Otras convenciones
- **Archivos:** `kebab-case.tsx`. Admin en `components/admin/`, worker en `components/worker/`
- **API routes:** verifican `auth()` primero; operaciones atómicas con `prisma.$transaction(async (tx: any) => ...)`
- **Moneda:** `formatCurrency(value)` → `S/ 0.00`
- **Stock:** internamente en unidades; mostrar con `formatUnitsToBoxes(stock, unitPerBox)`
- **Fechas:** `formatDate()` / `formatDateTime()` con zona `America/Lima`
- **Colores:** azul `#1e3a5f`, naranja `#f97316`
- **Companies derivadas en client:** `Array.from(new Map(products.map(p => [p.company.id, p.company])).values())` — NO usar spread con `Map.values()` ni `Set` (error TS2802)

---

## Archivos Clave

| Archivo | Propósito |
|---|---|
| `lib/auth.ts` | NextAuth config, JWT/session callbacks, roles |
| `lib/prisma.ts` | Singleton PrismaClient |
| `lib/utils.ts` | `formatCurrency`, `formatUnitsToBoxes`, `formatDate`, `getTodayStart/End`, `serialize` |
| `middleware.ts` | Protección rutas por rol |
| `components/providers.tsx` | SessionProvider + QueryClientProvider |
| `components/ui/input.tsx` | Input shadcn con onWheel blur global para type=number |
| `types/next-auth.d.ts` | Extensión Session (role, workerId, workerName) |
| `prisma/schema.prisma` | Modelo completo con relaciones y cascades |
| `prisma/seed.ts` | Datos demo (incluye categorías y productos especiales) |
| `prisma/prisma.config.ts` | Vacío (`export {}`). No borrar — artefacto de v7 |
| `app/api/payments/route.ts` | GET (balance por trabajador/todos) + POST (registrar pago) |
| `app/api/daily-sales/route.ts` | GET (?assignmentId) + POST batch (array de DailySale) |
| `components/shared/company-badge.tsx` | Badge accesible de empresa con color hash |
| `components/shared/product-search-combobox.tsx` | Buscador con filtro por nombre/empresa + teclado + `role="combobox"` |
| `components/shared/batch-group-card.tsx` | Card colapsable con header botón y `aria-expanded` |
| `lib/company-colors.ts` | `getCompanyColorClass()` (badge bg/text) + `getCompanyBorderClass()` (border-l coloreado) — hash deterministico |
| `lib/batch-grouping.ts` | `buildVisualBatches<T>()` + `getBatchProgress()` — lotes visuales y estado de cierre |
| `lib/product-types.ts` | `getProductLabels(productType)` → labels de contenedor/unidad |
| `vitest.config.ts` | Config de Vitest (jsdom + globals + alias @/) |
| `tests/` | Tests unitarios de componentes, lib y API schemas |

---

## Gotchas y Problemas Conocidos

1. **Prisma v7 incompatible:** Verificar `prisma@^5.x` si se reinstalan deps.

0. **SSG en producción:** Sin `export const dynamic = 'force-dynamic'` en `page.tsx`, Next.js cachea el HTML del build. Los datos nuevos no aparecen, los eliminados siguen visibles, y el segundo DELETE da 404. TODAS las pages con Prisma deben tener esta directiva.

2. **Zod v4 + RHF v7:** `z.coerce.number()` → tipo `unknown`. Usar `z.preprocess((v) => Number(v), z.number())` + `resolver as any`.

3. **Decimal no serializable:** Todo campo Decimal/Date de Prisma debe pasar por `serialize()` antes de llegar a Client Components.

4. **NextAuth v5 beta:** Server usa `auth()`, client usa `useSession()`.

5. **`distinct` en Prisma v5:** `findMany({ distinct: ['workerId'] })` puede generar tipos complejos → añadir `: any` en `.map()`.

6. **`prisma.config.ts`:** Artefacto de v7, vacío con `export {}`. No borrar.

7. **Middleware — `/settle` vs `/settlements`:** Check usa `pathname === "/settle" || pathname.startsWith("/settle/")` para no matchear `/settlements`.

8. **TS2802 — Map/Set spread:** `[...new Map(...).values()]` falla. Usar `Array.from(new Map(...).values())`.

9. **`type="number"` + ".":** Los inputs de precio usan `type="text"` + `inputMode="decimal"`. El browser borra el valor al escribir `"5."` con `type="number"`. Nunca usar `type="number"` para precios.

10. **Responsive worker — stepper overflow:** El `BoxUnitStepper` usa botones `w-10` (40px) y `CardContent` con `px-4` para evitar que el "+" se salga en pantallas de 360px.

11. **Viewport móvil:** El layout worker usa `style={{ minHeight: "100dvh" }}` (dynamic viewport height) en lugar de `min-h-screen` para cubrir el área completa incluyendo cuando la barra del browser se oculta.

12. **Vitest globals en TS:** `tsconfig.json` debe tener `"types": ["vitest/globals", "node"]`. El array `"types"` explícito excluye los tipos de Node por defecto; sin `"node"` el seed falla con `Cannot find name 'process'`.

13. **Caché stale de `.next/types`:** Tras borrar una ruta (ej: `/reports`), el directorio `.next/types/app/(admin)/reports/` queda y genera errores TS. Solución: `rm -rf .next` y volver a compilar.

14. **`scrollIntoView` en jsdom:** No existe en el entorno de test de Vitest. En componentes con scroll programático usar guardia: `if (typeof item?.scrollIntoView === "function") item.scrollIntoView(...)`. Sin esto los tests con `userEvent.keyboard("{ArrowDown}")` lanzan `TypeError`.

15. **Acordeones con sets "expandidos":** `AssignmentsClient` usa `expandedBatches: Set<string>` y `expandedWorkers: Set<string>` (set vacío = todos colapsados). La lógica es `isOpen = expandedSet.has(key)`. No confundir con el patrón inverso (`collapsedSet`).

16. **Tailwind classes en `lib/`:** Las clases dinámicas retornadas desde funciones en `lib/` (ej: `getCompanyBorderClass`) NO se incluyen en el CSS bundle si `lib/` no está en `tailwind.config.ts` content. Solución ya aplicada: `"./lib/**/*.{js,ts}"` está en el array `content` del config.

17. **Worker bottom nav vs botones fijos:** `WorkerBottomNav` usa `fixed bottom-0 z-50` (~64px de alto). Cualquier botón CTA fijo en páginas worker debe usar `fixed bottom-16` (no `bottom-0`) o quedará tapado por la barra de navegación. Ejemplo: el botón "Finalizar registro del día" en `settle-form.tsx`.

---

## TODOs Pendientes

- [ ] **PWA:** Agregar `next-pwa` para instalación en celular (trabajadores)
- [ ] **Paginación:** Settlements y Reports con muchos registros
- [ ] **Vista histórica assignments:** Date picker para ver asignaciones de días anteriores
- [ ] **Notificaciones en tiempo real:** Alertar al admin cuando un trabajador rinde
- [ ] **Export PDF/CSV:** Módulo settlements
- [ ] **Conectar BD de producción:** Supabase/Railway
- [ ] **Stock al cerrar asignación:** Al hacer DELETE /api/assignments/[id], se restaura el `remaining` al stock. Validar que el cálculo de remaining sea correcto (quantityAssigned - totalSold - totalMerma)
- [ ] **Historial de pagos:** Página dedicada con historial detallado de pagos por trabajador
- [ ] **Comisión base:** El balance usa `DailySale.quantitySold × salePrice` como base. Si hay ajustes de precio manuales, la comisión no los refleja (diseño conocido)
- [ ] **Filtro por categoría:** En assignments, filtrar productos por `ProductType`

---

## Escenarios de Prueba Pendientes

1. **Login con rol incorrecto** → redirige al destino correcto
2. **Asignar más stock del disponible** → API rechaza con 400
3. **Vendido + merma > remaining** → API rechaza DailySale con error claro
4. **Eliminar en cascada** → borrar empresa elimina productos, assignments y DailySales
5. **Stock bajo en dashboard** → producto con `stock <= lowStockAlert`
6. **Cierre de asignación** → DELETE restaura `remaining` correcto al stock
7. **Registro diario** → worker registra vendido+merma+pago → historial de asignación muestra el DailySale
8. **Pago a trabajador** → admin registra pago → balance se reduce → worker ve nuevo balance en home
9. **BoxUnitStepper** → botones no se salen en 360px; total nunca supera el remaining
10. **Scroll en inputs** → scroll encima de número no cambia el valor
11. **Precio con punto decimal** → escribir "5." no borra el valor
12. **ProductSearchCombobox** → filtrar por empresa muestra solo sus productos; Esc cierra dropdown
13. **Lotes visuales** → ingresos de 2 días distintos → aparecen como Lote #1 y Lote #2 (desc)
