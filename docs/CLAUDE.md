# CLAUDE.md — Contexto del Proyecto Trazzio

## Resumen
Sistema web para gestionar ventas de conservas: recepción de mercadería, asignación a trabajadores, rendición diaria y reportes. Dos roles: **Admin** (desktop/mobile) y **Trabajador** (mobile-first).

**Directorio del proyecto:** `/home/mapins/Escritorio/Trazzio/trazzio/`
**Docs adicionales:** `/home/mapins/Escritorio/Trazzio/docs/`

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js | 14.2.35 (App Router) |
| Base de datos | PostgreSQL | local |
| ORM | Prisma | v5.22 (⚠️ se downgradeó de v7 a v5) |
| Auth | NextAuth.js | v5 beta |
| UI | Tailwind + shadcn/ui | Tailwind 3.x |
| Estado | TanStack Query | v5 |
| Forms | react-hook-form + zod | RHF v7, Zod v4 |
| Runtime | Node.js / npm | — |

---

## Arquitectura de Rutas

```
app/
├── (auth)/login          → Página de login
├── (admin)/              → Layout: sidebar desktop + header
│   ├── dashboard         → Métricas del día (SSR)
│   ├── companies         → CRUD empresas y productos
│   ├── stock             → Recepción de mercadería + inventario
│   ├── workers           → CRUD trabajadores (con credenciales)
│   ├── assignments       → Asignaciones del día con useFieldArray
│   ├── settlements       → Historial de rendiciones
│   └── reports           → Reportes con filtros de fecha/worker/empresa
├── (worker)/             → Layout: header fijo + bottom nav
│   ├── home              → Productos asignados del día (SSR)
│   └── settle            → Formulario paso a paso por producto
└── api/
    ├── auth/[...nextauth]
    ├── companies/[id]
    ├── products/[id]
    ├── workers/[id]
    ├── stock
    ├── assignments/[id]
    ├── settlements
    └── reports
```

---

## Modelo de Datos (Prisma)

Modelos principales: `User`, `Worker`, `Company`, `Product`, `Assignment`, `Settlement`, `MermaItem`, `StockEntry`

**Enums:** `Role (ADMIN|WORKER)`, `AssignmentStatus (PENDING|SETTLED)`, `CommissionType (PERCENTAGE|FIXED)`

**Flujo:** Stock ingresa → Admin asigna a trabajador → Trabajador rinde (sobrante + merma) → Sistema calcula vendido → Admin confirma.

**Regla clave:** `vendido = asignado - sobrante - merma`

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

npm run dev           # servidor local
npm run db:push       # aplicar schema a BD sin migraciones
npm run db:migrate    # crear migración
npm run db:seed       # cargar datos demo
npm run db:studio     # Prisma Studio UI
npx tsc --noEmit      # verificar tipos TypeScript
```

**Seed crea:**
- Admin: `admin@trazzio.com` / `admin123`
- Trabajador: `trabajador@trazzio.com` / `worker123`
- 2 empresas demo + 3 productos con stock inicial

---

## Convenciones de Código

- **Páginas SSR** (sin "use client"): Usan `prisma` directamente, pasan datos como `initialData` a componentes client.
- **Componentes client** (`*-client.tsx`): Reciben `initialData`, usan React Query con `refetch`. Patrón: `useQuery({ initialData })`.
- **API routes**: Siempre verifican `auth()` primero. Usan `prisma.$transaction()` para operaciones atómicas con `(tx: any)`.
- **Zod v4 + RHF v7**: Para campos numéricos usar `z.preprocess((v) => Number(v), z.number())` + cast `resolver: zodResolver(schema) as Resolver<T>` o `as any`.
- **Nombres de archivos**: `kebab-case.tsx`. Componentes admin en `components/admin/`, worker en `components/worker/`.
- **Moneda**: siempre `formatCurrency()` de `@/lib/utils` → `S/ 0.00`
- **Stock**: internamente en unidades, mostrar con `formatUnitsToBoxes(stock, unitPerBox)`.
- **Fechas**: `formatDate()` / `formatDateTime()` con zona `America/Lima`.
- **Colores primarios**: `#1e3a5f` (azul oscuro), `#f97316` (naranja).

---

## Archivos Clave

| Archivo | Propósito |
|---|---|
| `lib/auth.ts` | Configuración NextAuth, callbacks JWT/session, roles |
| `lib/prisma.ts` | Singleton PrismaClient |
| `lib/utils.ts` | formatCurrency, formatUnitsToBoxes, formatDate, getTodayStart/End |
| `middleware.ts` | Protección de rutas por rol (ADMIN→/dashboard, WORKER→/home) |
| `components/providers.tsx` | SessionProvider + QueryClientProvider |
| `types/next-auth.d.ts` | Extensión de tipos Session (role, workerId, workerName) |
| `prisma/schema.prisma` | Modelo completo con relaciones y cascades |
| `prisma/seed.ts` | Datos iniciales demo |

---

## Problemas Conocidos / Gotchas

1. **Prisma v7 incompatible**: La versión instalada por defecto fue v7 (nueva API sin URL en schema). Se downgradeó a v5. Si se reinstalan deps, verificar que Prisma sea `^5.x`.

2. **Zod v4 + @hookform/resolvers v5**: `z.coerce.number()` retorna tipo `unknown` como input, causando error TypeScript con `useForm`. Solución: usar `z.preprocess((v) => Number(v), z.number())` y `resolver as Resolver<T>` o `as any`.

3. **`prisma.config.ts`**: Archivo generado por Prisma v7. Fue vaciado (`export {}`). No borrar, Next.js lo ignora pero Prisma v7 lo requeriría.

4. **NextAuth v5 beta**: Usa `auth()` del server, `useSession()` del client. La ruta API es `app/api/auth/[...nextauth]/route.ts` exportando `{ GET, POST } = handlers`.

5. **`distinct` en Prisma**: En `dashboard/page.tsx`, `prisma.assignment.findMany({ distinct: ['workerId'] })` puede generar tipos complejos; se añade `: any` en el `.map()`.

---

## TODOs / Próximos Pasos

- [ ] **Conectar PostgreSQL real**: Ajustar `DATABASE_URL` en `.env` y ejecutar `npm run db:push && npm run db:seed`
- [ ] **Probar flujo completo**: Admin crea empresa → crea producto → agrega stock → asigna a trabajador → trabajador rinde → admin ve reportes
- [ ] **PWA**: Agregar `next-pwa` para instalación en móvil (trabajadores)
- [ ] **Paginación**: Settlements y Reports pueden acumular muchos registros; agregar paginación server-side
- [ ] **Filtro de fecha en assignments**: Actualmente solo muestra el día de hoy; podría necesitar vista histórica
- [ ] **Notificaciones**: Alertas en tiempo real cuando un trabajador rinde (WebSocket o polling)
- [ ] **Multi-tenant**: El modelo está preparado para agregar `organizationId` en el futuro

---

## Escenarios de Prueba Pendientes

1. **Login con rol incorrecto** → debe redirigir al destino correcto
2. **Asignar más stock del disponible** → API debe rechazar con error 400
3. **Rendir con sobrante + merma > asignado** → API debe rechazar
4. **Doble rendición** → segunda llamada debe devolver "Ya rendida"
5. **Eliminación en cascada** → borrar empresa elimina productos, assignments y mermas
6. **Stock bajo** → crear producto con `stock <= lowStockAlert` y verificar alerta en dashboard
