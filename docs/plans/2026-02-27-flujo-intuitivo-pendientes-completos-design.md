# Diseño UX/UI + Dominio — Cierre de Pendientes del Flujo Intuitivo

Fecha: 2026-02-27
Estado: Aprobado por usuario

## 1. Objetivo

Cerrar todo lo que quedó pendiente del plan anterior para que el flujo operativo sea consistente de extremo a extremo:

- Mercadería por lotes persistidos
- Asignaciones con auditoría explícita
- Registro diario con validación robusta
- Responsive y accesibilidad en estándar operativo

## 2. Alcance

Incluye cambios en:

1. Dominio y base de datos (`Batch`, `auditStatus`, `batchId`, `product.code/aliases`).
2. API y contratos para operar por lote persistido y mantener compatibilidad con datos legacy.
3. UI/UX en Admin y Worker para reglas operativas completas.
4. Responsive/a11y y testing de regresión.

No incluye rediseño total del sistema ni cambios financieros fuera del flujo.

## 3. Decisiones de Arquitectura

1. Estrategia incremental compatible (sin corte brusco).
2. Lógica legacy por fecha se mantiene como fallback temporal.
3. Nuevos registros deben usar `batchId`.
4. Jerarquía UI se conserva: `Lote > Trabajador > Productos`.

## 4. Modelo de Datos Propuesto

### 4.1 Entidad nueva `Batch`

Campos:

- `id`
- `code` (`LOTE-0001`)
- `status` (`OPEN | CLOSED`)
- `openedAt`
- `closedAt?`
- `notes?`
- `createdBy?`

Relaciones:

- `Batch 1:N StockEntry`
- `Batch 1:N Assignment`

### 4.2 Extensión `Assignment`

- Mantener `status` (`ACTIVE | CLOSED`) por compatibilidad.
- Agregar `auditStatus` (`PENDING | IN_REVIEW | AUDITED`).
- Agregar `batchId` (nullable al inicio).

### 4.3 Extensión `StockEntry`

- Agregar `batchId` (nullable al inicio).

### 4.4 Extensión `Product`

- `code?`
- `aliases?` (normalizado para búsqueda)

## 5. Reglas de Negocio Definitivas

1. El registro diario mantiene: `restante = asignado_inicial - vendido - merma`.
2. Validación por producto: `vendido + merma <= asignado_inicial`.
3. `Lote +1` se habilita solo cuando el lote activo está completamente cerrado y auditado.
4. Cierre diario del trabajador requiere acción explícita y confirmación.

## 6. UX/UI por Módulo

### 6.1 Mercadería (Admin)

- Ingresos vinculados al lote activo.
- Historial agrupado por `Batch.code`.
- Header de lote con estado, fecha, empresas y total unidades.
- Cierre de lote condicionado por auditoría completa.

### 6.2 Asignaciones (Admin)

- Doble colapsable persistido: lote y trabajador.
- Estados de auditoría visibles por trabajador/producto.
- Acciones de cierre sin pérdida de trazabilidad.

### 6.3 Registro del día (Worker)

- Solo productos del lote activo.
- Restante visible y actualizado en tiempo real.
- Errores inline + resumen global de errores.
- CTA sticky: `Finalizar registro del día`, sin doble envío.

### 6.4 Combobox de catálogo grande

- Búsqueda por nombre, empresa, código y alias.
- Teclado completo y resultados contextualizados.
- Virtualización/render-window en listas largas.

## 7. Responsive y A11y

1. Breakpoints objetivo: 375, 768, 1024, 1440.
2. Mobile-first, sin overflow horizontal.
3. Targets táctiles >= 44px.
4. `focus-visible`, `aria-expanded`, `aria-live`, `role=alert`.
5. Soporte `prefers-reduced-motion`.

## 8. Estrategia de Migración

1. Migración 1: crear `Batch` y columnas nuevas nullable.
2. Backfill de históricos por fecha.
3. Endpoints nuevos usan `batchId` obligatorio en registros nuevos.
4. Fallback legacy solo para lectura de datos antiguos.
5. Endurecer constraints al finalizar estabilización.

## 9. Criterios de Éxito

1. El flujo Mercadería -> Asignaciones -> Registro funciona sobre lote persistido.
2. Auditoría es explícita y visible en todo el flujo admin.
3. Worker no ve mezcla de lotes y no puede enviar datos inválidos.
4. Catálogo 50+ usable sin fricción.
5. Sin regresiones en tests existentes y nuevas pruebas en PASS.

## 10. No Objetivos

1. Reescribir módulos fuera del flujo operativo.
2. Introducir nuevas reglas de pago/comisiones fuera del alcance.
3. Rediseño visual completo de la aplicación.
