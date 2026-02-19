## 7. PROMPTS PARA CLAUDE CODE

### PROMPT 1 — Inicialización del Proyecto

```
Crea un proyecto Next.js 14 con App Router llamado "trazzio" con la siguiente configuración:

Stack:
- Next.js 14 con App Router y TypeScript
- PostgreSQL con Prisma ORM
- NextAuth.js v5 para autenticación con roles (ADMIN, WORKER)
- Tailwind CSS + shadcn/ui
- React Query (TanStack Query v5)
- Zod para validación

Estructura de carpetas:
/app
  /(auth)/login — página de login
  /(admin)/dashboard — panel admin
  /(admin)/companies — empresas y productos
  /(admin)/stock — recepción de mercadería
  /(admin)/workers — gestión de trabajadores
  /(admin)/assignments — asignaciones del día
  /(admin)/settlements — revisión de rendiciones
  /(admin)/reports — reportes y estadísticas
  /(worker)/home — pantalla trabajador
  /(worker)/settle — formulario de rendición
/components/ui — shadcn components
/components/admin — componentes del panel admin
/components/worker — componentes mobile del trabajador
/lib — prisma client, auth, utils
/prisma — schema.prisma

Configura:
1. El schema de Prisma completo
2. NextAuth con credenciales (email + password, bcrypt)
3. Middleware de protección de rutas por rol
4. Layout responsivo: sidebar para admin en desktop, navbar inferior para trabajador en móvil
5. Seed inicial con un usuario admin (admin@trazzio.com / admin123)

El diseño debe ser mobile-first, limpio y profesional. Colores primarios: azul oscuro (#1e3a5f) y naranja (#f97316).
```

---

### PROMPT 2 — Módulo Empresas y Productos

```
Implementa el módulo de gestión de Empresas y Productos en /app/(admin)/companies para Trazzio.

Funcionalidades:
1. CRUD completo de empresas (nombre)
2. CRUD completo de productos por empresa:
   - nombre
   - precio de costo (Decimal)
   - precio de venta (Decimal, fijo, definido por admin)
   - unidades por caja (Int)
   - umbral de stock bajo (Int, default 10)
   - stock actual (calculado desde StockEntry menos asignaciones)
3. Vista de lista de empresas con contador de productos y stock total
4. Al hacer click en empresa, mostrar sus productos en tabla
5. Mostrar alerta visual (badge rojo) en productos con stock por debajo del umbral
6. Mostrar stock en unidades Y su equivalente en cajas (floor(stock/unitPerBox) cajas + N unidades)

Usa React Query para fetching, shadcn/ui para componentes, formularios con React Hook Form + Zod.
Las acciones de CRUD deben ser Server Actions de Next.js.
```

---

### PROMPT 3 — Recepción de Mercadería y Stock

```
Implementa el módulo de recepción de mercadería en /app/(admin)/stock para Trazzio.

Funcionalidades:
1. Formulario para registrar ingreso de stock:
   - Seleccionar empresa → filtrar productos de esa empresa
   - Seleccionar producto
   - Ingresar cantidad (puede ser en cajas o unidades, toggle)
   - Si ingresa en cajas, multiplicar por unitPerBox para calcular unidades totales
   - Fecha del ingreso (default hoy)
   - Notas opcionales
2. Al guardar, crear registro en StockEntry y sumar al stock del producto
3. Historial de ingresos: tabla con fecha, empresa, producto, cajas/unidades ingresadas
4. Resumen del stock actual: tabla con empresa, producto, stock en unidades, stock en cajas, alerta si está bajo umbral

Usar Server Actions para mutations, React Query para la tabla de historial.
```

---

### PROMPT 4 — Asignaciones Diarias

```
Implementa el módulo de asignaciones en /app/(admin)/assignments para Trazzio.

Funcionalidades:
1. Formulario de nueva asignación:
   - Seleccionar trabajador
   - Agregar múltiples productos en una misma asignación (tabla dinámica: empresa → producto → cantidad)
   - Mostrar stock disponible al lado de cada producto seleccionado
   - Validar que no se asigne más del stock disponible
   - Al confirmar: crear registros Assignment, descontar del stock de cada producto

2. Lista de asignaciones del día actual:
   - Por trabajador: productos asignados, cantidades, estado (PENDING / SETTLED)
   - Botón para ver detalle

3. Historial de asignaciones por fecha (date picker para filtrar)

4. Un trabajador puede recibir solo UNA asignación activa (status PENDING) por día

Usar Server Actions, React Query, shadcn/ui. Validaciones con Zod.
```

---

### PROMPT 5 — Rendición del Trabajador (Mobile)

```
Implementa el módulo de rendición para trabajadores en /app/(worker) para Trazzio.
Este módulo es 100% mobile-first (max-width 480px, touch-friendly).

Pantalla /worker/home:
- Saludo con nombre del trabajador
- Card con resumen de asignación del día: productos, cantidades asignadas, estado
- Botón grande "Rendir del día" (solo activo si hay asignación PENDING)
- Si ya rindió: mostrar resumen de lo vendido y monto entregado

Pantalla /worker/settle:
- Para cada producto asignado mostrar:
  - Nombre del producto + empresa
  - Cantidad asignada
  - Input numérico: "Cantidad sobrante" (0 a cantidad asignada)
  - Input numérico: "Merma" (0 a cantidad asignada - sobrante)
  - Cálculo automático en tiempo real: Vendido = Asignado - Sobrante - Merma
  - Monto a pagar por ese producto: Vendido × precio de venta
- Totales al final: total vendido (unidades), total a pagar (soles)
- Campo de notas opcional
- Botón "Enviar rendición" → crea Settlement y MermaItems, cambia Assignment a SETTLED

UX: Grande, legible, sin scroll horizontal, inputs numéricos con botones +/- para fácil uso en celular.
```

---

### PROMPT 6 — Revisión de Rendiciones (Admin)

```
Implementa el módulo de revisión de rendiciones en /app/(admin)/settlements para Trazzio.

Funcionalidades:
1. Lista de rendiciones del día: trabajador, productos, total vendido, monto a cobrar, estado
2. Cards con semáforo: verde = monto cuadra, rojo = hay diferencia
3. Vista detalle de rendición:
   - Tabla: producto, asignado, sobrante, merma, vendido, precio, subtotal
   - Total monto a cobrar vs monto pagado
   - Diferencia (si existe)
   - Notas del trabajador
4. El admin puede ajustar el monto pagado y agregar nota de ajuste
5. Filtrar rendiciones por fecha y por trabajador
6. Exportar a PDF o CSV (opcional, marcar como TODO)
```

---

### PROMPT 7 — Reportes y Dashboard

```
Implementa el módulo de reportes en /app/(admin)/reports y el dashboard en /app/(admin)/dashboard para Trazzio.

Dashboard (resumen del día actual):
- Total vendido hoy (unidades y soles)
- Ganancia del día (suma de (salePrice - costPrice) × vendido por cada producto)
- Trabajadores: cuántos han rendido vs pendientes
- Productos con stock bajo (lista rápida con empresa)
- Gráfico de barras: ventas por trabajador del día

Módulo de Reportes con tabs:

TAB 1 - Ventas por Trabajador:
- Filtro por rango de fecha
- Tabla: trabajador, días trabajados, total unidades vendidas, total soles, comisión, ganancia generada
- Ganancia por trabajador = suma de (salePrice - costPrice - comisión) × vendido

TAB 2 - Inventario Actual:
- Tabla por empresa → productos
- Stock en unidades + equivalente en cajas
- Badge rojo si stock < umbral
- Filtro por empresa

TAB 3 - Merma:
- Filtro por rango de fecha y empresa
- Tabla: empresa, producto, total unidades de merma, pérdida en soles (merma × costPrice)
- Total de pérdidas por merma en el período

TAB 4 - Ganancias:
- Filtro por rango de fecha (date range picker)
- Ganancia bruta = (salePrice - costPrice) × unidades vendidas
- Desglosada por día, semana o mes (toggle)
- Gráfico de línea de ganancias en el tiempo

TAB 5 - Stock Bajo:
- Lista de productos por debajo del umbral
- Empresa a la que pertenece cada uno
- Stock actual vs umbral configurado
- Botón rápido para registrar ingreso de stock

Usar Recharts para gráficos, React Query para datos, date-fns para manejo de fechas.
```

---

### PROMPT 8 — Gestión de Trabajadores y Comisiones

```
Implementa el módulo de trabajadores en /app/(admin)/workers para Trazzio.

Funcionalidades:
1. CRUD de trabajadores:
   - Nombre
   - Teléfono
   - Comisión (puede ser % sobre ventas o monto fijo por día, el admin elige el tipo)
   - Crear usuario con email y contraseña temporal para que el trabajador acceda

2. Al crear trabajador: crear User con role WORKER + Worker asociado

3. Perfil del trabajador:
   - Historial de asignaciones y rendiciones
   - Total vendido (período seleccionable)
   - Comisión acumulada
   - Merma acumulada

4. Cambiar contraseña de trabajador (el admin puede resetearla)

Validaciones con Zod, Server Actions para mutations.
```

---

## 8. ORDEN DE IMPLEMENTACIÓN

1. ✅ Setup del proyecto (Prompt 1)
2. ✅ Empresas y Productos (Prompt 2)
3. ✅ Recepción de Stock (Prompt 3)
4. ✅ Gestión de Trabajadores (Prompt 8)
5. ✅ Asignaciones Diarias (Prompt 4)
6. ✅ Rendición del Trabajador (Prompt 5)
7. ✅ Revisión Admin (Prompt 6)
8. ✅ Dashboard y Reportes (Prompt 7)
