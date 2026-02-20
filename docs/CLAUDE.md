# CLAUDE.md — Contexto del Proyecto Trazzio

## Resumen
Sistema web fullstack para gestionar ventas de conservas. Ciclo completo: recepción de mercadería → asignación a trabajadores → rendición diaria → reportes de ganancias, inventario y merma.

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
│   ├── settlements     → Rendiciones: cards semáforo + filtros + detalle + ajuste admin
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

**Regla central (actualizada):**
- `vendido = asignado - sobrante` ← merma NO resta el vendido
- `amountDue = vendido × salePrice`
- La merma se registra en `MermaItem` para reportes del admin, pero el trabajador responde financieramente por todo lo no devuelto.

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
npm run db:push && npm run db:seed
npx tsc --noEmit
```

Seed crea: `admin@trazzio.com / admin123` y `trabajador@trazzio.com / worker123`

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

> **⚠️ CRÍTICO:** Prisma devuelve `Decimal`, `Date`, `BigInt` no serializables.
> Siempre `serialize()` antes de pasar datos a Client Components.

### Formularios con Zod v4 + RHF v7 (solo admin)
```typescript
// z.coerce.number() da tipo unknown → usar preprocess
const schema = z.object({
  price: z.preprocess((v) => Number(v), z.number()),
})
resolver: zodResolver(schema) as Resolver<FormData>  // o "as any"
```

> ⚠️ El `settle-form.tsx` del worker usa **estado local React** (no RHF) para evitar
> bugs de sincronización con Controller + useFieldArray en arrays dinámicos.

### shadcn/ui — FormLabel fuera de FormField
`<FormLabel>` llama internamente a `useFormField()`, que lanza error si no está dentro de `<FormField><FormItem>`. Usar `<label className="text-sm font-medium leading-none">` para etiquetas fuera de ese contexto.

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
| `middleware.ts` | Protección rutas por rol |
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
| Stock | `stock-client.tsx` | Ingreso cajas/unidades con cálculo mutuo automático; inventario con columna Unidades; historial con columna Unidades |
| Trabajadores | `workers-client.tsx` | CRUD con tipo comisión (% o fijo), credenciales login, reset password |
| Asignaciones | `assignments-client.tsx` | Multi-producto x trabajador; toggle cajas/unidades por fila; columna Unidades + Valor Venta en tabla |
| Rendiciones | `settlements-client.tsx` | Filtros fecha+trabajador, cards semáforo ✓/✗, Sheet detalle, ajuste monto admin |
| Reportes | `reports-client.tsx` | 5 tabs: trabajadores, inventario, merma, ganancias (LineChart), stock bajo |

### Worker (mobile-first)
| Módulo | Componente | Descripción |
|---|---|---|
| Header | `worker-header.tsx` | Logo + nombre trabajador + botón Salir |
| Home | `worker-home.tsx` | Asignaciones del día, pendientes vs rendidos |
| Rendición | `settle-form.tsx` | Paso a paso; `BoxUnitStepper` (cajas + unidades juntos); merma informacional; pago global en último paso; distribución proporcional |

---

## Gotchas y Problemas Conocidos

1. **Prisma v7 incompatible:** Verificar `prisma@^5.x` si se reinstalan deps.

2. **Zod v4 + RHF v7:** `z.coerce.number()` → tipo `unknown`. Usar `z.preprocess((v) => Number(v), z.number())` + `resolver as any`.

3. **Decimal no serializable:** Todo campo Decimal/Date de Prisma debe pasar por `serialize()` antes de llegar a Client Components.

4. **NextAuth v5 beta:** Server usa `auth()`, client usa `useSession()`.

5. **`distinct` en Prisma v5:** `findMany({ distinct: ['workerId'] })` puede generar tipos complejos → añadir `: any` en `.map()`.

6. **`prisma.config.ts`:** Artefacto de v7, vacío con `export {}`. No borrar.

7. **Middleware — `/settle` vs `/settlements`:** El check `startsWith("/settle")` matcheaba `/settlements`. Corrección: usar `pathname === "/settle" || pathname.startsWith("/settle/")` para rutas worker.

8. **Controller con key dinámico:** Agregar `key` a `<Controller>` en arrays puede hacer que RHF desregistre el campo y pierda su valor. En `settle-form.tsx` se resolvió eliminando RHF y usando estado local directo.

9. **Warning "Extra attributes from server":** `data-tag-assistant-prod-present` en `<html>` lo inyecta la extensión Google Tag Assistant del navegador. No es un bug del código.

---

## Lógica de Rendición (settle-form.tsx) — Diseño Actual

- **Estado local** (no RHF): `useState<ItemState[]>` por producto
- **BoxUnitStepper**: cuando `unitPerBox > 1`, muestra dos steppers lado a lado (Cajas + Unidades)
- **Merma**: informacional, no reduce `vendido`. `calcSold = assigned - returned`
- **Flujo**: el worker llena sobrante y merma para cada producto usando "Siguiente/Anterior"; en el último producto aparece el campo global "Monto total entregado"
- **Submit**: itera todos los items, distribuye `amountPaid` proporcionalmente (`paid_i = due_i × (globalPaid / totalDue)`), evitando montos negativos en cualquier settlement
- **API**: `totalSold = quantityAssigned - quantityReturned` (merma no afecta amountDue)

---

## TODOs Pendientes

- [ ] **PWA:** Agregar `next-pwa` para instalación en celular (trabajadores)
- [ ] **Paginación:** Settlements y Reports con muchos registros
- [ ] **Vista histórica assignments:** Date picker para ver asignaciones de días anteriores
- [ ] **Notificaciones en tiempo real:** Alertar al admin cuando un trabajador rinde
- [ ] **Export PDF/CSV:** Módulo settlements
- [ ] **Conectar BD de producción:** Supabase/Railway
- [ ] **Stock al rendir:** Validar si los sobrantes restauran el stock al crear un settlement (actualmente solo se restaura al eliminar un assignment pendiente)
- [ ] **Merma en reportes:** Verificar que la merma aparezca correctamente en Tab 3 de Reportes ahora que no afecta el amountDue

---

## Escenarios de Prueba Pendientes

1. **Login con rol incorrecto** → redirige al destino correcto según rol
2. **Asignar más stock del disponible** → API rechaza con 400
3. **Rendir con sobrante > asignado** → API rechaza con "El sobrante supera lo asignado"
4. **Doble rendición** → segunda llamada devuelve "Ya rendida" (400)
5. **Eliminación en cascada** → borrar empresa elimina productos, assignments y mermas
6. **Stock bajo en dashboard** → crear producto con `stock <= lowStockAlert` y verificar alerta
7. **Ajuste de monto admin** → rendición con diferencia → admin ajusta → diferencia = 0
8. **Filtros de rendiciones** → filtrar por fecha + trabajador
9. **Cálculo de comisión** → Tab 1 Reportes con comisión % vs fija
10. **Distribución proporcional de pago** → worker paga menos del total → cada settlement muestra diferencia proporcional (no negativa)
11. **BoxUnitStepper** → verificar que cajas × unitPerBox + unidades nunca supere el máximo asignado
12. **Asignación en cajas** → toggle cajas en assignments; valor guardado = cajas × unitPerBox en unidades
