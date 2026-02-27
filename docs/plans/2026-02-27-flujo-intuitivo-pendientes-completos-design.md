# Diseño UX/UI + Dominio — Cierre de Pendientes del Flujo Intuitivo

Fecha: 2026-02-27
Estado: Aprobado por usuario

## 0. Contexto obligatorio para nueva sesion

### 0.1 Base del proyecto (fuente de verdad)

- Contexto general: `docs/CLAUDE.md`
- Stack obligatorio: Next.js 14, Prisma v5, PostgreSQL local, Tailwind + shadcn/ui.
- Regla de pages dinamicas: usar `export const dynamic = 'force-dynamic'` en pages con datos.
- Regla de serializacion: todo dato Prisma a client component debe pasar por `serialize()`.

### 0.2 Estado actual confirmado antes de este plan

- Ya existe UI colapsable `Lote > Trabajador` en asignaciones.
- Ya existe filtro de lote activo en `settle-form`.
- Ya existe CTA `Finalizar registro del día`.
- Ya existe combobox basica por nombre/empresa.
- El lote actualmente es mayormente visual (derivado por fecha), no persistido como entidad de dominio.

### 0.3 Problemas que este plan SI resuelve

- Falta de `Batch` persistido y trazabilidad formal de lotes.
- Falta de `auditStatus` operativo en asignaciones.
- Falta de busqueda por `product.code` y `aliases`.
- Falta de validaciones inline + resumen global en registro diario.
- Falta de hardening responsive/a11y estandarizado para todo el flujo.

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

### 6.5 Tokens UI y consistencia visual

- Mantener lenguaje visual actual del sistema (azul `#1e3a5f`, naranja `#f97316`) sin rediseño radical.
- Jerarquia visual: encabezado de lote -> resumen trabajador -> detalle producto.
- Densidad controlada: tablas en desktop, tarjetas/filas compactas en mobile.
- Interacciones: hover y focus visibles, sin cambios de layout bruscos.
- No usar emojis como iconos; usar set consistente (Lucide ya existente).

### 6.6 Reglas UX no negociables

1. El usuario worker nunca debe mezclar productos de dos lotes en un mismo registro diario.
2. El admin debe poder identificar en menos de 3 segundos: lote activo, estado de auditoria y bloqueo de `Lote +1`.
3. Todo error bloqueante debe verse inline y ademas en resumen global de formulario.
4. El CTA final diario debe permanecer visible y estable en pantallas de 375px.

## 7. Responsive y A11y

1. Breakpoints objetivo: 375, 768, 1024, 1440.
2. Mobile-first, sin overflow horizontal.
3. Targets táctiles >= 44px.
4. `focus-visible`, `aria-expanded`, `aria-live`, `role=alert`.
5. Soporte `prefers-reduced-motion`.

### 7.1 Matriz responsive por pantalla

- Mercaderia:
  - 375: cards por lote, totales resumidos, tabla solo en detalle expandido.
  - 768+: tabla compacta con headers visibles.
- Asignaciones:
  - 375: acordeon lote y trabajador, filas de producto en bloques.
  - 1024+: tabla completa por trabajador.
- Registro diario worker:
  - 375: stepper y CTA sticky sin recorte.
  - 768+: mayor densidad con resumen lateral o inferior segun espacio.

### 7.2 Matriz A11y minima requerida

1. Cada input editable tiene label visible.
2. Cada colapsable usa `button` semantico + `aria-expanded`.
3. Errores usan `role=\"alert\"` o `aria-live=\"polite\"`.
4. Navegacion completa por teclado en combobox y acordeones.
5. `focus-visible:ring-2` en controles interactivos.

## 8. Estrategia de Migración

1. Migración 1: crear `Batch` y columnas nuevas nullable.
2. Backfill de históricos por fecha.
3. Endpoints nuevos usan `batchId` obligatorio en registros nuevos.
4. Fallback legacy solo para lectura de datos antiguos.
5. Endurecer constraints al finalizar estabilización.

### 8.1 Criterios de salida de migracion

- Cuando 100% de nuevos `StockEntry` y `Assignment` incluyan `batchId`, se puede retirar fallback de escritura.
- Cuando historicos esten backfilleados y validados, evaluar remover fallback por fecha en lectura.
- Cualquier retiro de fallback requiere regression suite en PASS y QA manual de 3 escenarios reales.

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

## 11. Entregables de diseño para handoff

1. Este documento como fuente de verdad de UX/UI y dominio incremental.
2. Plan de implementacion trazable por tareas TDD.
3. Checklist de QA responsive/a11y con criterios objetivos.
