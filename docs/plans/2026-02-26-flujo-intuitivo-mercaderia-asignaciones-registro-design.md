# Diseño UX/UI — Flujo Intuitivo (Mercadería, Asignaciones y Registro del Día)

Fecha: 2026-02-26  
Estado: Aprobado por usuario

## 1. Objetivo

Mejorar el sistema para que sea intuitivo y de flujo simple en operación diaria, con foco en:

- Identificación rápida por empresa en Mercadería.
- Búsqueda eficiente de productos en catálogos de ~50 ítems.
- Asignación clara para 20-25 productos por trabajador.
- Registro diario con cálculos automáticos visibles y cierre explícito.
- Estructura por lotes consistente en Mercadería y Asignaciones.

## 2. Decisiones validadas con usuario

- Estrategia: mejora incremental sobre la UI actual.
- Regla de lote nuevo: `Lote +1` automático cuando se cierra auditoría completa del lote vigente.
- Registro del trabajador: mostrar solo productos del lote activo.
- Patrón en Asignaciones: doble colapsable (primero lote, luego trabajador).
- Registro diario: botón explícito `Finalizar registro del día`.

## 3. Arquitectura de pantallas y flujo

### 3.1 Mercadería

- Sección `Últimos ingresos` separada por lotes numerados (`Lote 01`, `Lote 02`, ...).
- Cada lote será colapsable con cabecera de contexto: lote, fecha/hora, empresa(s), total unidades.
- En detalle del lote, cada producto debe incluir badge de empresa visualmente distinguible.

### 3.2 Asignaciones

- Nivel 1 colapsable por `Lote N`.
- Nivel 2 colapsable por `Trabajador` dentro de cada lote.
- Cada trabajador muestra productos asignados y estado de auditoría.
- Al quedar auditados/cerrados todos los trabajadores del lote, transición automática a `Lote N+1`.

### 3.3 Registro del día (trabajador)

- Solo se muestran productos del lote activo.
- Por producto: asignado inicial, vendido, merma y restante calculado automáticamente.
- Acción principal fija y clara: `Finalizar registro del día`.

## 4. Diseño de interacción

### 4.1 Empresas distinguibles

- Reutilizar `CompanyBadge` con color estable por empresa.
- No depender solo de color: incluir texto y señal secundaria (borde/indicador).

### 4.2 Búsqueda de productos (50+)

- Sustituir dropdown extenso por combobox con búsqueda por nombre, empresa y alias/código (si existe).
- Soporte de teclado completo (flechas, Enter, Escape).
- Si hay más de 50 resultados: virtualización de lista para rendimiento.
- Mostrar contexto en resultados (empresa, stock, unidad).

### 4.3 Asignación de 20-25 productos

- Encabezado de trabajador con resumen operativo (productos, unidades, avance).
- Lista editable compacta con totales siempre visibles.
- Estados claros: `Pendiente`, `En revisión`, `Auditado`.

### 4.4 Registro del día

- Cálculo visible por producto en tiempo real.
- Resumen sticky inferior con totales (vendido, merma, restante global).
- Confirmación previa al envío final.

## 5. Reglas funcionales

### 5.1 Cálculo

- Fórmula por producto: `restante = asignado_inicial - vendido - merma`.

### 5.2 Validaciones

- `vendido >= 0`
- `merma >= 0`
- `vendido + merma <= asignado_inicial`
- Si falla validación: bloquear envío y mostrar error inline + resumen de errores.

### 5.3 Finalización

- `Finalizar registro del día` deja el registro en estado `Completado` con timestamp.
- Evitar doble envío con loading/disabled.

## 6. Diseño responsive

- En mobile: acordeones por lote/trabajador y tarjetas compactas de producto.
- En tablet/desktop: tablas y grillas densas para lectura rápida.
- Mobile-first con escala fluida de tipografía y spacing (`clamp`).
- Touch targets mínimos de 44px.
- Sin scroll horizontal en 375px.

## 7. Base UI/UX aplicada (skills)

- `ui-ux-pro-max`: priorizar patrón Data-Dense + Drill-Down para entorno operativo.
- `ui-ux-pro-max`: accesibilidad en formularios (labels, feedback de submit, errores anunciados).
- `responsive-design`: jerarquía mobile-first, colapsables estables y layout adaptable en 375/768/1024/1440.

## 8. Fases de implementación

1. Mercadería: lotes colapsables + empresa visible + búsqueda mejorada.
2. Asignaciones: doble colapsable lote/trabajador + progreso de auditoría.
3. Registro del día: datos completos + cálculo automático + CTA final explícita.
4. QA responsive y accesibilidad básica.

## 9. Criterios de éxito

- Buscar producto entre 50+ ítems de forma rápida y sin dropdown largo.
- Identificar empresa y lote de inmediato en Mercadería.
- Operar Asignaciones sin confusión por estructura lote > trabajador.
- Registrar el día con claridad de restante y cierre explícito.
- Crear `Lote +1` de forma automática al cerrar auditoría completa.
