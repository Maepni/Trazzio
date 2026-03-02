# Diseño UX/UI — Flujo Intuitivo (Mercadería, Asignaciones y Registro del Día)

Fecha: 2026-02-26  
Estado: Aprobado por usuario

## 1. Contexto de negocio

El sistema se usa en operación diaria para:

- Registrar ingresos de mercadería.
- Asignar productos por trabajador.
- Registrar ventas/merma diarias del trabajador.

Problemas detectados:

- Catálogo de productos amplio (~50), dropdown largo dificulta selección.
- Asignaciones de 20-25 productos por trabajador generan carga visual/confusión.
- Falta estructura clara por lotes para saber qué corresponde a qué.
- Registro diario sin cierre explícito visible.
- Necesidad de mostrar cálculos clave (restante) en el mismo flujo.

## 2. Objetivo

Lograr un flujo operativo intuitivo, rápido y sin ambigüedad, con coherencia entre Mercadería, Asignaciones y Registro del día.

## 3. Decisiones validadas con usuario

1. Estrategia incremental sobre la UI actual.
2. Asignaciones con doble colapsable: `Lote > Trabajador`.
3. `Lote +1` automático al cerrar auditoría completa del lote vigente.
4. Registro del trabajador muestra solo productos del lote activo.
5. Botón de cierre explícito: `Finalizar registro del día`.

## 4. Modelo mental unificado

- Mercadería: crea y organiza ingresos por lote.
- Asignaciones: distribuye ese lote por trabajador.
- Registro del día: consume solo el lote activo del trabajador.

Este modelo evita mezcla de contextos y reduce errores operativos.

## 5. Arquitectura de pantallas

### 5.1 Mercadería

- Sección `Últimos ingresos` agrupada por lotes visuales (`Lote 01`, `Lote 02`, ...).
- Cada lote en tarjeta colapsable con:
  - Id de lote
  - Fecha/hora
  - Empresa(s)
  - Total unidades
- Detalle del lote con lista de productos y empresa claramente identificada.

### 5.2 Asignaciones

- Nivel 1 colapsable por lote.
- Nivel 2 colapsable por trabajador dentro del lote.
- Cada trabajador muestra:
  - productos asignados
  - totales
  - estado de auditoría (`Pendiente`, `En revisión`, `Auditado`)
- Cuando todos los trabajadores de lote están auditados/cerrados, lote cambia a cerrado y se habilita siguiente lote.

### 5.3 Registro del día (trabajador)

- Solo productos del lote activo.
- Por producto mostrar:
  - asignado inicial
  - vendido
  - merma
  - restante automático
- CTA principal sticky: `Finalizar registro del día`.
- Paso de confirmación antes de envío final.

## 6. Diseño de interacción

### 6.1 Identidad por empresa

- `CompanyBadge` consistente y reutilizable.
- Debe incluir texto y contraste suficiente.
- No depender solo de color (accesibilidad): agregar borde/indicador adicional.

### 6.2 Selección de productos (50+)

- Reemplazar selects largos por combobox.
- Búsqueda por:
  - nombre producto
  - empresa
  - código/alias (si existe)
- Soporte teclado: `ArrowUp`, `ArrowDown`, `Enter`, `Escape`.
- Resultado con contexto: empresa, stock actual, unidad.
- Virtualizar lista cuando supere ~50 items para rendimiento.

### 6.3 Asignaciones masivas (20-25)

- Encabezado de trabajador con resumen operativo.
- Lista compacta editable por producto con feedback inmediato.
- Mantener acción principal visible en formularios largos.

### 6.4 Registro del día

- Cálculo en tiempo real por producto.
- Resumen sticky inferior:
  - vendido total
  - merma total
  - restante global
- Bloquear doble envío tras clic de cierre.

## 7. Reglas funcionales

### 7.1 Fórmula de restante

`restante = asignado_inicial - vendido - merma`

### 7.2 Validaciones

- `vendido >= 0`
- `merma >= 0`
- `vendido + merma <= asignado_inicial`
- Si falla:
  - error inline por producto
  - resumen de errores global
  - envío bloqueado

### 7.3 Finalización del registro diario

- Botón explícito de cierre.
- Confirmación previa con resumen.
- Persistencia con estado `Completado` + timestamp.

## 8. Sistema visual aplicado (UI/UX)

Base aplicada desde skills:

- Patrón recomendado: `Data-Dense + Drill-Down` para contexto operativo.
- Jerarquía visual alta: encabezados claros, sumarios y detalle progresivo.
- Interacciones de alto rendimiento y bajo ruido visual.
- Feedback explícito en carga, éxito y error.

## 9. Responsive y accesibilidad

### 9.1 Breakpoints

- 375px (mobile)
- 768px (tablet)
- 1024px (desktop)
- 1440px (wide)

### 9.2 Comportamiento

- Mobile: acordeones por lote/trabajador + tarjetas.
- Tablet/Desktop: grillas y tablas compactas.
- Espaciado mobile-first (`px-4 sm:px-6 lg:px-8`).
- Tipografía/spacing fluidos (`clamp`) cuando aplique.
- Targets táctiles mínimos de 44px.
- Sin scroll horizontal en mobile.

### 9.3 A11y mínimo

- Labels visibles en inputs.
- Errores con `role="alert"` o `aria-live`.
- Colapsables con `button` + `aria-expanded`.
- Navegación por teclado completa en combobox/acordeones.

## 10. Criterios de éxito

1. Producto localizable rápidamente en catálogo grande sin dropdown extenso.
2. Empresa y lote identificables de inmediato en Mercadería y Asignaciones.
3. Flujo de asignación entendible con jerarquía `Lote > Trabajador`.
4. Registro del día con cálculo de restante visible y cierre inequívoco.
5. `Lote +1` solo tras cierre completo de auditoría del lote actual.

## 11. No objetivos (para evitar desvíos)

- No rediseñar el sistema completo desde cero.
- No introducir nuevas entidades complejas fuera del modelo de lote actual.
- No cambiar reglas financieras ajenas a este flujo.

## 12. Handoff para nueva sesión

Al iniciar implementación en sesión nueva, mantener estas decisiones como inmutables:

1. Doble colapsable en Asignaciones.
2. Lote +1 automático por cierre completo.
3. Registro diario solo del lote activo.
4. Botón `Finalizar registro del día` obligatorio y visible.
5. Enfoque incremental y responsive mobile-first.
