# CLAUDE.md — Contexto del Proyecto Trazzio

## Resumen
Sistema web fullstack para gestionar ventas de conservas. Cubre el ciclo completo: recepción de mercadería de proveedores → asignación a trabajadores → rendición diaria → reportes de ganancias, inventario y merma.

- **Dos roles:** Admin (desktop/mobile) y Trabajador (mobile-first)
- **Directorio:** `/home/mapins/Escritorio/Trazzio/trazzio/`
- **Docs:** `/home/mapins/Escritorio/Trazzio/docs/`
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
| Forms | react-hook-form + zod | RHF v7, Zod v4 |
| Gráficos | Recharts | instalado |

---

## Arquitectura de Rutas

```
app/
├── (auth)/login
├── (admin)/
│   ├── dashboard       → KPIs del día + gráfico barras trabajadores (SSR + DashboardChart client)
│   ├── companies       → CRUD empresas y productos
│   ├── stock           → Recepción de mercadería + historial + inventario
│   ├── workers         → CRUD trabajadores + credenciales
│   ├── assignments     → Asignaciones diarias (multi-producto)
│   ├── settlements     → Rendiciones: cards semáforo + filtros + detalle + ajuste admin
│   └── reports         → 5 tabs: trabajadores, inventario, merma, ganancias, stock bajo
├── (worker)/
│   ├── home            → Asignaciones del día + resumen (SSR)
│   └── settle          → Formulario paso a paso con steppers +/−
└── api/
    ├── auth/[...nextauth]
    ├── companies/          GET, POST
    ├── companies/[id]      PUT, DELETE
    ├── products/           GET, POST
    ├── products/[id]       PUT, DELETE
    ├── workers/            GET, POST
    ├── workers/[id]        PUT, DELETE
    ├── stock               GET, POST
    ├── assignments/        GET (hoy), POST
    ├── assignments/[id]    DELETE
    ├── settlements/        GET (con filtros: from, to, workerId), POST
    ├── settlements/[id]    PATCH (ajuste de monto por admin)
    └── reports             GET (con filtros + dailyBreakdown)
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

**Regla central:** `vendido = asignado - sobrante - merma`

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
cd /home/mapins/Escritorio/Trazzio/trazzio
npm run dev
npm run db:push && npm run db:seed
npx tsc --noEmit
```

Seed crea: `admin@trazzio.com / admin123` y `trabajador@trazzio.com / worker123`

---

## Convenciones de Código

### Patrón SSR → Client
```typescript
// page.tsx (Server Component)
import { serialize } from "@/lib/utils"          // ← SIEMPRE serializar
const data = await prisma.model.findMany(...)
return <ComponentClient initialData={serialize(data)} />

// component-client.tsx
"use client"
const { data } = useQuery({ queryKey: [...], queryFn: ..., initialData })
```

> **⚠️ CRÍTICO:** Prisma devuelve `Decimal`, `Date` y `BigInt` como objetos no serializables.
> **SIEMPRE** llamar `serialize()` antes de pasar datos a Client Components.
> `serialize<T>(data: T): T` → `JSON.parse(JSON.stringify(data))`

### Formularios con Zod v4 + RHF v7
```typescript
// z.coerce.number() da tipo unknown → usar preprocess
const schema = z.object({
  price: z.preprocess((v) => Number(v), z.number()),
})
// Castear el resolver
resolver: zodResolver(schema) as Resolver<FormData>  // o "as any"
```

### Otras convenciones
- **Archivos:** `kebab-case.tsx`. Admin en `components/admin/`, worker en `components/worker/`
- **API routes:** verifican `auth()` primero; operaciones atómicas con `prisma.$transaction(async (tx: any) => ...)`
- **Moneda:** `formatCurrency(value)` → `S/ 0.00`
- **Stock:** internamente en unidades; mostrar con `formatUnitsToBoxes(stock, unitPerBox)`
- **Fechas:** `formatDate()` / `formatDateTime()` con zona `America/Lima`
- **Colores:** azul `#1e3a5f`, naranja `#f97316`
- **Gráficos:** Recharts con `<ResponsiveContainer>` + `<LineChart>` / `<BarChart>`

---

## Archivos Clave

| Archivo | Propósito |
|---|---|
| `lib/auth.ts` | NextAuth config, JWT/session callbacks, roles |
| `lib/prisma.ts` | Singleton PrismaClient |
| `lib/utils.ts` | `formatCurrency`, `formatUnitsToBoxes`, `formatDate`, `getTodayStart/End`, `serialize` |
| `middleware.ts` | Protección rutas por rol (ADMIN→/dashboard, WORKER→/home) |
| `components/providers.tsx` | SessionProvider + QueryClientProvider |
| `types/next-auth.d.ts` | Extensión Session (role, workerId, workerName) |
| `prisma/schema.prisma` | Modelo completo con relaciones y cascades |
| `prisma/seed.ts` | Datos demo |
| `prisma/prisma.config.ts` | Vacío (`export {}`). No borrar — artefacto de v7 |

---

## Módulos Implementados

### Admin
| Módulo | Componente | Descripción |
|---|---|---|
| Dashboard | `dashboard/page.tsx` + `dashboard-chart.tsx` | KPIs del día, gráfico barras ventas x trabajador, pendientes, stock bajo |
| Empresas | `companies-client.tsx` | CRUD empresas + CRUD productos inline |
| Stock | `stock-client.tsx` | Formulario ingreso (cajas/unidades), historial, resumen inventario |
| Trabajadores | `workers-client.tsx` | CRUD con tipo comisión (% o fijo), credenciales login, reset password |
| Asignaciones | `assignments-client.tsx` | Multi-producto x trabajador, valida stock disponible, historial x fecha |
| Rendiciones | `settlements-client.tsx` | Filtros fecha+trabajador, cards con semáforo ✓/✗, Sheet detalle, ajuste monto admin |
| Reportes | `reports-client.tsx` | 5 tabs: trabajadores (días+comisión), inventario (cajas), merma (S/), ganancias (LineChart día/semana/mes), stock bajo (botón ingreso rápido) |

### Worker (mobile-first)
| Módulo | Componente | Descripción |
|---|---|---|
| Header | `worker-header.tsx` | Logo + nombre trabajador + botón Salir (signOut) |
| Home | `worker-home.tsx` | Asignaciones del día, pendientes vs rendidos |
| Rendición | `settle-form.tsx` | Paso a paso, steppers +/−, cálculo en tiempo real, notas globales |

---

## Gotchas y Problemas Conocidos

1. **Prisma v7 incompatible:** Si se reinstalan deps, verificar `prisma@^5.x`. La v7 cambió la API radicalmente.

2. **Zod v4 + RHF v7:** `z.coerce.number()` → tipo `unknown`. Usar `z.preprocess((v) => Number(v), z.number())` + `resolver as any`.

3. **Decimal no serializable:** Todo dato de Prisma con campos `Decimal` (costPrice, salePrice, commission, amountDue, etc.) debe pasar por `serialize()` antes de llegar a Client Components.

4. **NextAuth v5 beta:** Server usa `auth()`, client usa `useSession()`. Ruta API: `app/api/auth/[...nextauth]/route.ts` exporta `{ GET, POST } = handlers`.

5. **`distinct` en Prisma v5:** `findMany({ distinct: ['workerId'] })` puede generar tipos complejos → añadir `: any` en el `.map()`.

6. **`prisma.config.ts`:** Artefacto de v7, vaciado con `export {}`. No borrar.

---

## TODOs Pendientes

- [ ] **PWA:** Agregar `next-pwa` para que trabajadores instalen la app en celular
- [ ] **Paginación:** Settlements y Reports con muchos registros necesitan paginación server-side
- [ ] **Vista histórica assignments:** Actualmente solo muestra el día de hoy; agregar date picker para historial
- [ ] **Notificaciones en tiempo real:** WebSocket o polling para alertar al admin cuando un trabajador rinde
- [ ] **Export PDF/CSV:** En módulo settlements (marcado como TODO en UI)
- [ ] **Multi-tenant:** El modelo está preparado para `organizationId` en el futuro
- [ ] **Conectar BD de producción:** Ajustar `DATABASE_URL` para Supabase/Railway en producción

---

## Escenarios de Prueba Pendientes

1. **Login con rol incorrecto** → debe redirigir al destino correcto según rol
2. **Asignar más stock del disponible** → API debe rechazar con 400
3. **Rendir con sobrante + merma > asignado** → API rechaza (validación en `api/settlements/route.ts`)
4. **Doble rendición** → segunda llamada devuelve "Ya rendida" (status 400)
5. **Eliminación en cascada** → borrar empresa debe eliminar productos, assignments y mermas
6. **Stock bajo en dashboard** → crear producto con `stock <= lowStockAlert` y verificar alerta
7. **Ajuste de monto admin** → rendición con diferencia → admin ajusta desde Sheet detalle → diferencia queda en 0
8. **Filtros de rendiciones** → filtrar por fecha + trabajador y verificar que los datos coincidan
9. **Cálculo de comisión** → verificar Tab 1 de Reportes con comisión % vs comisión fija
10. **Gráfico de ganancias** → toggle día/semana/mes en Tab 4 de Reportes
