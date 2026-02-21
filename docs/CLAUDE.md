# CLAUDE.md — Contexto del Proyecto Trazzio

## Resumen
Sistema web fullstack para gestionar ventas de conservas. Ciclo: recepción de mercadería → asignación a trabajadores → rendición diaria → reportes de ganancias, inventario y merma.

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
│   ├── companies       → CRUD empresas y productos
│   ├── stock           → Recepción de mercadería + historial + inventario
│   ├── workers         → CRUD trabajadores + credenciales
│   ├── assignments     → Asignaciones diarias (multi-producto)
│   ├── settlements     → Rendiciones: cards agrupadas por trabajador/día
│   └── reports         → 5 tabs: trabajadores, inventario, merma, ganancias, stock bajo
├── (worker)/
│   ├── home            → Asignaciones del día + resumen (SSR)
│   └── settle          → Rendición paso a paso con BoxUnitStepper
└── api/
    ├── auth/[...nextauth]
    ├── companies/[id]      GET, POST, PUT, DELETE
    ├── products/[id]       GET, POST, PUT, DELETE
    ├── workers/[id]        GET, POST, PUT, DELETE
    ├── stock               GET, POST
    ├── assignments/        GET (hoy), POST
    ├── assignments/[id]    DELETE
    ├── settlements/        GET (filtros: from, to, workerId), POST
    ├── settlements/[id]    PATCH (ajuste monto admin)
    └── reports             GET (filtros + dailyBreakdown)
```

---

## Modelo de Datos (Prisma)

```
User          id, email, password, role(ADMIN|WORKER)
Worker        id, name, phone, commission(Decimal), commissionType(PERCENTAGE|FIXED), userId
Company       id, name
Product       id, name, companyId, costPrice(Decimal), salePrice(Decimal),
              unitPerBox, lowStockAlert, stock
Assignment    id, workerId, productId, date, quantityAssigned, quantityReturned,
              quantitySold, status(PENDING|SETTLED)
Settlement    id, assignmentId, settledAt, totalSold, totalMerma,
              amountDue(Decimal), amountPaid(Decimal), difference(Decimal), notes
MermaItem     id, assignmentId, productId, quantity, reason
StockEntry    id, productId, quantity, boxes, entryDate, notes
```

**Regla central:**
- `vendido = asignado - sobrante` ← merma NO resta el vendido
- `amountDue = vendido × salePrice`
- La merma se registra en `MermaItem` (solo informacional); el trabajador responde por todo lo no devuelto

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
npm run dev
npx prisma db push && npm run db:seed   # reset + recrear tablas + seed
npx tsc --noEmit                        # verificar tipos
```

> ⚠️ `prisma migrate reset` borra las tablas pero NO las recrea (el proyecto usa `db push`, no migraciones). Siempre seguir con `npx prisma db push && npm run db:seed`.

Seed crea: `admin@trazzio.com / admin123` y `trabajador@trazzio.com / worker123`

---

## Comportamiento Actual de los Módulos

### Stock (Recepción de Mercadería)
- **Flujo:** Seleccionar empresa → aparecen todos sus productos → ingresar **Cajas + Unidades** por separado (aditivo: total = cajas × unitPerBox + unidades)
- Submit crea una `StockEntry` por producto con qty > 0 (múltiples POST en serie)

### Asignaciones
- **Flujo:** Seleccionar trabajador → seleccionar empresa → aparecen todos sus productos con stock > 0 → ingresar Cajas + Unidades por producto
- Solo productos con qty > 0 se incluyen en el POST
- La tabla muestra asignaciones agrupadas por trabajador

### Rendición del Trabajador (`settle-form.tsx`)
- **Estado local** (no RHF): `useState<ItemState[]>` por producto
- **BoxUnitStepper** para sobrante (cajas + unidades), **Stepper simple** para merma (solo unidades)
- **Monto al admin por producto**: cada producto tiene su propio input `amountPaid` — sin distribución proporcional
- El último paso muestra resumen total + campo de notas global
- Submit: itera items, usa `item.amountPaid` directamente para cada `Settlement`

### Rendiciones Admin (`settlements-client.tsx`)
- Cards agrupadas: **un card por trabajador/día** (agrupa todos sus productos)
- El card muestra: worker, fecha, lista de productos, total a cobrar, estado
- Al hacer clic: Sheet con tabla de todos los productos (vendido, a cobrar, pagó, diferencia)
- Ajuste inline por producto individual dentro del Sheet (ícono lápiz por fila)
- Agrupación es client-side por `workerId + date` (primeros 10 chars de `settledAt`)

---

## Convenciones de Código

### Patrón SSR → Client
```typescript
// page.tsx (Server Component)
import { serialize } from "@/lib/utils"   // ← SIEMPRE serializar
const data = await prisma.model.findMany(...)
return <ComponentClient initialData={serialize(data)} />

// component-client.tsx
"use client"
const { data } = useQuery({ queryKey: [...], queryFn: ..., initialData })
```

> **⚠️ CRÍTICO:** Prisma devuelve `Decimal`, `Date`, `BigInt` no serializables. Siempre `serialize()` antes de pasar datos a Client Components.

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
| `prisma/seed.ts` | Datos demo |
| `prisma/prisma.config.ts` | Vacío (`export {}`). No borrar — artefacto de v7 |

---

## Gotchas y Problemas Conocidos

1. **Prisma v7 incompatible:** Verificar `prisma@^5.x` si se reinstalan deps.

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

---

## TODOs Pendientes

- [ ] **PWA:** Agregar `next-pwa` para instalación en celular (trabajadores)
- [ ] **Paginación:** Settlements y Reports con muchos registros
- [ ] **Vista histórica assignments:** Date picker para ver asignaciones de días anteriores
- [ ] **Notificaciones en tiempo real:** Alertar al admin cuando un trabajador rinde
- [ ] **Export PDF/CSV:** Módulo settlements
- [ ] **Conectar BD de producción:** Supabase/Railway
- [ ] **Stock al rendir:** Validar si los sobrantes restauran el stock al crear un settlement (actualmente solo se restaura al eliminar un assignment pendiente)
- [ ] **Merma en reportes:** Verificar que la merma aparezca correctamente en Tab 3 de Reportes

---

## Escenarios de Prueba Pendientes

1. **Login con rol incorrecto** → redirige al destino correcto
2. **Asignar más stock del disponible** → API rechaza con 400
3. **Rendir con sobrante > asignado** → API rechaza con "El sobrante supera lo asignado"
4. **Doble rendición** → segunda llamada devuelve "Ya rendida" (400)
5. **Eliminación en cascada** → borrar empresa elimina productos, assignments y mermas
6. **Stock bajo en dashboard** → producto con `stock <= lowStockAlert`
7. **Ajuste de monto admin** → rendición con diferencia → admin ajusta → diferencia = 0
8. **Filtros de rendiciones** → filtrar por fecha + trabajador
9. **Distribución de pago por producto** → worker paga monto diferente por cada producto → cada settlement muestra su propia diferencia (no proporcional, no negativa)
10. **BoxUnitStepper** → botones no se salen de pantalla en 360px; cajas × unitPerBox + unidades nunca supera el máximo asignado
11. **Scroll en inputs** → hacer scroll encima de un número no cambia el valor
12. **Precio con punto decimal** → escribir "5." en precio costo/venta no borra el valor
13. **Agrupación admin** → worker con 3 productos → aparece 1 card (no 3) → click muestra 3 filas en Sheet
