# Plan de Mejoras v2 — Trazzio

Fecha: 2026-02-24
Estado: Diseño aprobado — listo para implementación

---

## Resumen

Seis mejoras estructurales acordadas tras sesión de brainstorming:

1. Tipos de producto con formatos de ingreso variables
2. Precios irregulares para admin-trabajador (en rendición)
3. Inventario agrupado por empresa + búsqueda
4. Corrección de stock (eliminar entrada + ajuste negativo)
5. Login con username en vez de email
6. Botón sticky en formularios con listas que crecen

---

## 1. Tipos de Producto con Formatos Variables

### Objetivo
Reemplazar `category` (cosmética) e `isSpecial` (confuso) por un `productType` funcional que controla las etiquetas de ingreso en todo el sistema.

### Cambios en Schema
```prisma
enum ProductType {
  ESTANDAR
  LECHE
  ARROZ
}

model Product {
  // ELIMINAR: category ProductCategory
  // ELIMINAR: isSpecial Boolean
  // AGREGAR:
  productType ProductType @default(ESTANDAR)
}
```

### Mapeo de etiquetas
| productType | Contenedor | Unidad |
|-------------|-----------|--------|
| ESTANDAR    | Cajas     | Unidades |
| LECHE       | Bolsas    | Latas |
| ARROZ       | Costales  | Kilos |

La función utilitaria `getProductLabels(type)` en `lib/product-types.ts` centraliza este mapeo.

### Archivos afectados
- `prisma/schema.prisma` — eliminar enum ProductCategory, agregar ProductType
- `prisma/seed.ts` — actualizar productos demo
- `lib/product-types.ts` — **nuevo**: función getProductLabels
- `components/admin/product-dialog.tsx` — switch de tipo en vez de select categoría + checkbox isSpecial
- `app/(admin)/stock/` — usar labels dinámicas en RecepciónForm
- `app/(admin)/assignments/` — usar labels dinámicas en AssignmentsForm
- `app/(worker)/settle/` — usar labels dinámicas en BoxUnitStepper
- `app/(admin)/companies/` — eliminar badges de categoría e isSpecial, mostrar badge de tipo

### UI — Switch en product-dialog
El formulario de producto muestra un selector de tipo (radio o segmented control):
```
Tipo de producto:  ○ Estándar  ○ Leche  ○ Arroz
```
Al seleccionar Leche → los campos `unitPerBox` y cantidad muestran "Bolsas" y "Latas".

---

## 2. Precios Irregulares para Admin-Trabajador

### Objetivo
Eliminar `customSalePrice` de assignments. El admin-trabajador puede anotar en la rendición por qué entregó menos dinero del esperado, sin afectar el flujo normal de los demás trabajadores.

### Cambios en Schema
```prisma
model Assignment {
  // ELIMINAR: customSalePrice Decimal?
}
```
Sin campos nuevos. Se reutiliza `Settlement.notes`.

### Lógica
- `amountDue = vendido × product.salePrice` (siempre, sin excepción)
- Detección de admin-worker: `session.workerId` → buscar `worker.user.role === ADMIN`
- En settle-form, por cada producto: si admin-worker → mostrar textarea "Nota de precio irregular"
- Al guardar: si hay nota → `Settlement.notes = "[PRECIO IRREGULAR] " + nota`
- En settlements-client (admin): settlements con ese prefijo muestran badge naranja "⚠ Precio irregular" + nota en Sheet de detalle

### Archivos afectados
- `prisma/schema.prisma` — eliminar customSalePrice de Assignment
- `app/api/assignments/route.ts` — eliminar campo customSalePrice del POST
- `components/worker/settle-form.tsx` — agregar textarea condicional por producto
- `app/(worker)/settle/page.tsx` — pasar flag isAdminWorker al componente
- `components/admin/settlements-client.tsx` — badge "⚠ Precio irregular" + mostrar nota
- `components/admin/assignments-client.tsx` — eliminar columna/input customSalePrice

---

## 3. Inventario Agrupado + Búsqueda

### Objetivo
La pestaña "Inventario Actual" en Stock muestra productos agrupados por empresa con búsqueda en tiempo real.

### UI
```
[ 🔍 Buscar producto...          ]

▼ Nestlé (3 productos)
  Leche Gloria 1L     45 Latas
  Arroz Costeño      120 Kilos
  Chocolate Sublime   60 Unidades

▼ Alicorp (2 productos)
  ...
```
- Grupos expandidos por defecto, colapsables
- Búsqueda filtra por nombre, colapsa grupos sin resultados
- Badge rojo de stock bajo se mantiene

### Archivos afectados
- `app/(admin)/stock/` — componente de inventario actual (refactor de tabla plana a vista agrupada)
- Sin cambios en API

---

## 4. Corrección de Stock

### Objetivo
Permitir corregir errores de ingreso y registrar pérdidas en bodega.

### Mecanismo 1: Eliminar entrada por error
- Botón ✕ en la tabla del historial de stock
- `DELETE /api/stock/[id]` → elimina StockEntry + resta quantity al Product.stock
- Guard: rechaza si `product.stock - entry.quantity < 0`

### Mecanismo 2: Ajuste negativo (pérdida)
- Botón "Registrar ajuste" en la página de stock
- Dialog con: select producto + input cantidad + campo razón
- Crea `StockEntry` con quantity negativa + `notes = "[AJUSTE] " + razón`

### Historial
- Entradas normales: flecha verde ↑
- Ajustes negativos: flecha roja ↓ + razón visible

### Archivos afectados
- `app/api/stock/[id]/route.ts` — **nuevo**: DELETE handler
- `app/api/stock/route.ts` — POST ya existente, agregar soporte quantity negativa
- `app/(admin)/stock/` — botón ✕ en historial + dialog de ajuste

---

## 5. Login con Username

### Objetivo
Reemplazar `email` por `username` para creación de usuarios más rápida.

### Cambios en Schema
```prisma
model User {
  // CAMBIAR: email String @unique → username String @unique
}
```

### Archivos afectados
- `prisma/schema.prisma` — email → username
- `prisma/seed.ts` — usuarios demo usan username
- `lib/auth.ts` — credentials provider usa username para buscar usuario
- `app/(auth)/login/` — campo tipo text, placeholder "Nombre de usuario"
- `components/admin/worker-credentials-dialog.tsx` (o equivalente) — campo username
- `types/next-auth.d.ts` — si tiene email en tipos extendidos, actualizar

---

## 6. Botón Sticky en Formularios

### Objetivo
En formularios con listas de productos que crecen (asignaciones, recepción de stock), el botón de acción siempre es visible.

### Implementación
```tsx
// Contenedor del formulario
<div className="flex flex-col h-full">
  <div className="flex-1 overflow-y-auto space-y-3 pb-2">
    {/* lista de productos */}
  </div>
  <div className="sticky bottom-0 bg-background border-t pt-3 pb-2">
    <Button type="submit" className="w-full">Confirmar</Button>
  </div>
</div>
```

### Archivos afectados
- `components/admin/assignments-form.tsx`
- `components/admin/stock-form.tsx` (o equivalente de recepción)

---

## Decision Log

| # | Decisión | Alternativas | Razón |
|---|----------|-------------|-------|
| 1 | `productType` enum | Labels libres en BD | Tipos fijos conocidos, un solo lugar para cambios |
| 2 | Eliminar `category` + `isSpecial` | Mantener como cosmética | Sin valor funcional con productType |
| 3 | Eliminar `customSalePrice` | Mantenerlo | No se registran ventas por cliente |
| 4 | Nota irregular en `Settlement.notes` con prefijo | Campo nuevo en schema | Reutiliza estructura, cero cambios en schema |
| 5 | Nota irregular solo para admin-worker | Visible para todos | El negocio requiere control exclusivo del admin |
| 6 | Nota irregular por Settlement (por producto) | Una nota global | Precisión por producto |
| 7 | Delete + ajuste negativo para stock | Solo ajuste | Delete para errores, ajuste para pérdidas con razón |
| 8 | StockEntry con quantity negativa | Modelo StockAdjustment separado | Sin nuevas tablas, historial unificado |
| 9 | Inventario agrupado + búsqueda | Solo filtros dropdown | Más visual, no requiere conocer empresa de antemano |
| 10 | `username` reemplaza `email` | Email opcional | Creación de usuarios más rápida |
| 11 | Botón sticky `sticky bottom-0` | Modal de confirmación | Menos pasos, siempre accesible |

---

## Orden de implementación sugerido

1. **Username** — Cambio de schema más aislado, sin dependencias con otras mejoras
2. **ProductType** — Cambio de schema + utilidad central antes de tocar UI
3. **Botón sticky** — Cambio de UI puro, sin schema
4. **Inventario agrupado** — Cambio de UI puro, sin schema
5. **Corrección de stock** — API nueva + UI, schema mínimo
6. **Precios irregulares** — Último porque requiere eliminar customSalePrice (más impacto)
