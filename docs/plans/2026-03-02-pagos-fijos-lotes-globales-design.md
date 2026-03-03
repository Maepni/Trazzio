# Diseño funcional integral: pago fijo diario + lotes globales correlativos

Fecha: 2026-03-02
Estado: Aprobado para implementación futura
Tipo de documento: Diseño funcional y UX/UI

## 1) Resumen ejecutivo

Este documento define dos cambios de negocio centrales y su impacto integral en el sistema:

1. Comisión `FIXED` por trabajador:
- Debe acumularse **una sola vez por día con reporte** (no por producto, no por línea de venta).

2. Lotes de operación (mercadería + asignaciones):
- Deben ser **globales y correlativos** (`Lote 1`, `Lote 2`, `Lote 3`, ...), sin reiniciar.
- El nuevo lote solo puede abrirse cuando el lote actual esté completamente auditado/cerrado.

Además, se conserva la lógica de inventario acordada:
- El stock es **acumulado global** (no segregado por lote para consumo/FIFO).
- El sobrante del lote anterior permanece o se devuelve a stock al auditar/cerrar asignaciones.
- En el siguiente lote, el stock disponible total incluye sobrantes + nuevos ingresos.

## 2) Contexto actual relevado

### 2.1 Problema actual de pago fijo

En el cálculo de balance del trabajador, cuando `commissionType = FIXED`, hoy se multiplica por unidades vendidas:
- `totalEarned += totalSold * commission`

Eso produce sobrepago para el caso de negocio esperado.

### 2.2 Problema actual de numeración de lotes

La UI etiqueta lotes por orden visual (`index + 1`), por lo que la numeración puede reiniciarse y no es persistente.

Resultado no deseado:
- Tras cerrar/auditar un ciclo y volver a mercadería/asignaciones, puede verse de nuevo `Lote #1` en lugar de continuar `Lote #2`.

## 3) Decisiones cerradas con el usuario

1. `FIXED` se computa **una vez por día con reporte** por trabajador.
2. Lotes son **globales correlativos únicos** para todo el sistema.
3. Se mantiene historial y se continúa con el siguiente número (no renumerar histórico).
4. Modelo de stock deseado:
- Ejemplo válido: Lote 1 ingresa 100, asigna 80, quedan 20, se audita/cierra, nuevo ingreso abre Lote 2 y stock total = 20 + nuevo ingreso.
5. Nuevo lote `N+1` solo se habilita cuando **todos los trabajadores/asignaciones del lote actual** estén auditados/cerrados.

## 4) Objetivos de negocio

1. Evitar sobrecálculo de pagos en modalidad fija.
2. Tener trazabilidad consistente por lote en todo el flujo operativo.
3. Mantener experiencia clara para administración en desktop y móvil.
4. Preservar continuidad operativa del inventario sin complejidad FIFO.

## 5) Alcance funcional

### Incluye

1. Redefinir lógica funcional de comisión `FIXED` a diario por reporte.
2. Unificar lote activo global para:
- ingresos de mercadería
- nuevas asignaciones
3. Reglas de apertura/cierre de lote con condición de auditoría completa.
4. Etiquetado de lote persistente y correlativo en todas las vistas relevantes.
5. Ajustes UX/UI y responsive para comunicar estado del lote y bloqueos.

### No incluye

1. Costeo por lote ni consumo FIFO/FEFO.
2. Separación de stock disponible por lote para despacho.
3. Reingeniería completa de reporting financiero histórico (solo ajuste de regla FIXED según alcance de migración acordada en implementación).

## 6) Modelo conceptual del dominio

### 6.1 Comisión FIXED (nueva regla)

Para cada trabajador:

- Definir conjunto de días con reporte: fechas en las que exista al menos un registro diario con movimiento.
- Movimiento válido por día: al menos una de estas condiciones:
  - `quantitySold > 0`
  - `quantityMerma > 0`
  - `amountPaid > 0`
- Comisión fija devengada:
  - `totalEarnedFixed = diasConReporte * commission`

Notas:
- Si reporta 1 o 10 productos el mismo día, cuenta 1 sola vez.
- Si no hay movimiento ese día, no suma fijo.

### 6.2 Lote operativo global

- Existe un lote activo global `OPEN`.
- Mercadería nueva y asignaciones nuevas se vinculan al lote activo.
- Al completar auditoría/cierre total del lote activo:
  - el lote pasa a `CLOSED`
  - queda habilitada apertura del siguiente lote correlativo
- La numeración debe persistir y no depender del orden visual de tablas.

## 7) Flujos de usuario esperados

### 7.1 Flujo de cierre de ciclo y nuevo lote

1. Admin revisa asignaciones activas del lote actual.
2. Admin audita/cierra asignaciones pendientes por trabajador.
3. Sistema devuelve sobrantes a stock total cuando corresponde.
4. Cuando no queda nada activo sin auditar del lote actual:
- se habilita acción para abrir nuevo lote.
5. Admin abre nuevo lote.
6. Desde ese momento, nuevos ingresos y asignaciones quedan en el nuevo lote.

### 7.2 Flujo de reporte diario del trabajador

1. Trabajador registra su reporte diario (ventas/merma/pago) en productos activos.
2. Sistema guarda registros diarios por asignación.
3. Para cálculo de comisión fija:
- el día cuenta una sola vez para ese trabajador si hubo movimiento.

## 8) Reglas de negocio detalladas

### RB-01 Comisión fija diaria
- Aplica solo si `commissionType = FIXED`.
- Unidad de acumulación: `día` por `trabajador`.
- Fórmula: días únicos con reporte * monto fijo configurado.

### RB-02 Comisión porcentual sin cambios
- `PERCENTAGE` mantiene cálculo actual sobre monto debido por ventas.

### RB-03 Único lote abierto global
- No puede haber múltiples lotes `OPEN` operativos para ingresos/asignaciones.

### RB-04 Bloqueo de nuevo lote
- Mientras existan asignaciones activas/no auditadas en lote actual, no se abre lote siguiente.

### RB-05 Correlatividad persistente
- Todo lote nuevo toma correlativo siguiente al último existente.
- No reinicia por fecha, filtros o pantalla.

### RB-06 Stock acumulado global
- El inventario visible/usable es total acumulado.
- No se reserva por lote para consumo en esta etapa.

### RB-07 Cierre y devolución de sobrantes
- Al cierre/auditoría de asignaciones, sobrantes retornan al stock global.

## 9) UX/UI por pantalla

## 9.1 Mercadería (admin)

Objetivo UX:
- Hacer explícito el lote activo y evitar ingresos en lote incorrecto.

Elementos clave:
1. Cabecera con estado de lote:
- `Lote activo: #N` + estado `Abierto/Cerrado`.
2. Acción principal:
- `Registrar ingreso` usa siempre lote activo.
3. Si lote cerrado y aún no abierto siguiente:
- mostrar CTA contextual: `Abrir nuevo lote`.
4. Si no se puede abrir:
- mensaje claro de bloqueo con motivo (pendientes de auditoría).

Copy recomendado:
- "No puedes abrir un nuevo lote hasta auditar/cerrar todas las asignaciones del lote actual."

## 9.2 Asignaciones (admin)

Objetivo UX:
- Mantener continuidad entre lote, auditoría y nueva asignación.

Elementos clave:
1. Acordeón por lote debe mostrar número persistente real, no relativo visual.
2. Para lote actual:
- indicadores de progreso: trabajadores pendientes, productos activos, deuda pendiente.
3. Acción `Nueva asignación`:
- visible y habilitada solo si existe lote activo válido para operar.
4. Acción de auditoría:
- destacar que el cierre devuelve sobrante al stock total.

Copy recomendado:
- "Al auditar, el sobrante vuelve al inventario general y queda listo para el siguiente lote."

## 9.3 Trabajadores / Pagos (admin)

Objetivo UX:
- Evitar confusión del cálculo fijo y hacerlo auditable.

Elementos clave:
1. En tarjetas/detalle de balance mostrar:
- `Días con reporte` (cuando comisión es fija).
- `Fórmula aplicada`: `días * monto fijo`.
2. Mantener `Pendiente`, `Total pagado`, `Total ganado`.
3. Tooltip/ayuda breve para FIXED:
- "Se calcula una vez por día con reporte, aunque reportes varios productos."

## 9.4 Rendición del trabajador

Objetivo UX:
- No cambiar flujo principal, pero garantizar datos consistentes para el conteo diario.

Elementos clave:
1. Mantener resumen de confirmación antes de enviar.
2. Reforzar feedback de envío exitoso por día.
3. Evitar ambigüedad de fecha (usar fecha visible del registro).

## 10) Requisitos responsive

### Principios
1. Mobile-first para módulos admin más usados en campo.
2. Jerarquía clara: estado de lote + CTA principal siempre visibles.
3. Controles táctiles mínimos 44px de alto.

### Breakpoints objetivo
1. 375px (móvil chico)
2. 768px (tablet)
3. 1024px (laptop)
4. 1440px (desktop ancho)

### Comportamientos esperados
1. En móvil:
- cabecera compacta con `Lote activo` + badge estado.
- tarjetas KPI en 1 columna o 2 columnas según ancho útil.
- tablas densas con scroll horizontal controlado o vista tipo tarjeta.
2. En desktop:
- mantener vista densa/tabular para productividad.

### Accesibilidad
1. Botones colapsables con `aria-expanded` consistente.
2. Contraste AA en badges de estado (`pendiente`, `auditado`, `bloqueado`).
3. Mensajes de error/estado visibles sin depender solo del color.

## 11) Estados y mensajes

### Estados vacíos
1. Sin asignaciones activas:
- "No hay asignaciones activas en el lote actual."
2. Sin movimientos del día:
- "No registraste movimientos hoy."

### Estados bloqueados
1. Nuevo lote bloqueado:
- "Primero completa la auditoría/cierre del lote actual para abrir el siguiente."

### Estados de éxito
1. Auditoría completada:
- "Auditoría completada. El sobrante fue devuelto al inventario general."
2. Lote abierto:
- "Lote #N abierto correctamente."

## 12) Criterios de aceptación funcionales

1. Comisión FIXED
- Dado un trabajador FIXED con múltiples productos reportados el mismo día,
- cuando se calcula balance,
- entonces se suma exactamente 1 monto fijo por ese día.

2. Comisión FIXED con múltiples días
- Dado reportes en 3 fechas distintas,
- entonces el devengado fijo es `3 * commission`.

3. Numeración de lotes
- Dado historial con lotes previos,
- cuando se abre nuevo lote,
- entonces su número es el siguiente correlativo y no reinicia.

4. Bloqueo de siguiente lote
- Dado un lote con asignaciones activas no auditadas,
- cuando se intenta abrir lote nuevo,
- entonces el sistema debe impedirlo y explicar motivo.

5. Stock acumulado
- Dado sobrante auditado del lote anterior,
- y nuevo ingreso en lote siguiente,
- entonces stock disponible total refleja suma de ambos.

## 13) Riesgos y consideraciones de migración (contexto para próxima sesión)

1. Datos históricos de lotes sin vínculo persistente:
- podrían necesitar estrategia de mapeo para continuidad visual y correlativa.

2. Diferencia entre fecha local y UTC:
- puede afectar conteo de "día con reporte" si no se normaliza criterio.

3. Impacto en reportes históricos de pagos:
- definir si el nuevo cálculo FIXED aplica retroactivo o solo desde fecha de corte.

## 14) Decisiones pendientes para implementación (no bloquean este diseño)

1. Fecha de corte para recalcular balances FIXED:
- retroactivo total vs desde activación.

2. Convención visual final del código de lote:
- `Lote #N` (usuario) y formato técnico interno (`LOTE-000N`).

3. Ubicación exacta de CTA "Abrir nuevo lote" en Mercadería y Asignaciones.

## 15) Handoff para nueva sesión

Si este documento se toma como fuente única en nueva sesión, se debe respetar:

1. Regla FIXED diaria (nunca por producto/unidad).
2. Lote global correlativo único.
3. Apertura de lote nuevo solo tras auditoría/cierre total del lote actual.
4. Stock acumulado general (sin FIFO por lote).
5. UX con mensajes explícitos de estado y bloqueo.
6. Responsive y accesibilidad en vistas admin críticas.

Fin del documento.
