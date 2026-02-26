# Diseño UX/UI — Flujo Intuitivo (Mercadería, Asignaciones, Rendiciones)

Fecha: 2026-02-26  
Estado: Aprobado por usuario

## 1. Objetivo

Mejorar la usabilidad operativa del sistema para que el flujo sea simple e intuitivo, especialmente en:

- Registro y ajuste de stock.
- Asignación de productos con catálogo amplio (~50 productos).
- Registro diario del trabajador (20-25 productos asignados).
- Lectura de información sin depender de la pestaña Reportes.

## 2. Decisiones validadas

- Eliminar completamente `Reportes` de navegación y rutas.
- Mover la información útil a `Mercadería`, `Asignaciones` y `Rendiciones`.
- Usar búsqueda tipo combobox/autocomplete (no dropdown largo) para productos.
- Manejar lotes como agrupación visual y numeración secuencial (`Lote #1`, `Lote #2`, ...).
- `Razón` en quitar stock: siempre visible, siempre opcional.

## 3. Arquitectura de información (sin Reportes)

### Mercadería

- Operaciones de ingreso, retiro y ajuste de stock.
- Historial reciente agrupado por lote visual numerado.
- Contexto por empresa claramente identificable por badge/estilo consistente.

### Asignaciones

- Asignaciones activas.
- Historial agrupado por trabajador y lote visual numerado.
- Resumen operativo por bloque para lectura rápida.

### Rendiciones

- Registro diario del trabajador con datos explícitos por producto.
- Confirmación final con resumen antes de envío.
- Historial operativo y estado de cierre del día.

## 4. Diseño de interacción

### Búsqueda de productos (catálogo grande)

- Reemplazar selects largos por `ProductSearchCombobox`.
- Búsqueda en tiempo real por nombre de producto y empresa.
- Resultado muestra: producto, empresa, stock actual, tipo de unidad.
- Soporte de teclado: flechas, Enter, Escape.
- Estado sin resultados con sugerencia útil.
- Selección múltiple con chips y edición de cantidades.

### Formularios largos

- CTA sticky al fondo para mantener acción principal visible.
- Copys directos: `Registrar`, `Asignar`, `Finalizar registro del día`.
- Feedback de envío: loading, éxito, error.

### Quitar stock

- Campo `Razón (opcional)` siempre visible.
- No bloquea envío cuando está vacío.

## 5. Diseño visual

### Empresa distinguible

- `CompanyBadge` reutilizable con:
- Texto (nombre empresa) + color consistente por empresa.
- Contraste accesible y no depender solo del color.

### Lotes visuales

- `BatchGroupCard` con:
- Encabezado: `Lote #N`, fecha/hora, usuario/responsable, notas, totales.
- Cuerpo expandible/colapsable con detalle de productos.

## 6. Rendición del trabajador (claridad de datos)

Por producto mostrar:

- Asignado inicial.
- Vendido hoy.
- Merma hoy.
- Restante calculado automáticamente.
- Restante acumulado (si aplica).

Regla visible:

- `restante = asignado_inicial - vendido_acumulado - merma_acumulada`

Acción final:

- Botón explícito `Finalizar registro del día`.
- Pantalla/resumen de confirmación previa a envío.

## 7. Enfoque seleccionado

Se adopta el **enfoque equilibrado**:

- Mejoras estructurales de UX sin rediseño profundo de dominio.
- Reuso de APIs y componentes actuales donde sea posible.
- Extensiones puntuales de endpoints solo si faltan metadatos para lotes visuales.

## 8. Alcance técnico propuesto

1. Eliminar `Reportes` de UI y rutas.
2. Crear componentes reutilizables:
- `ProductSearchCombobox`
- `BatchGroupCard`
- `CompanyBadge`
3. Integrar combobox y patrón de lotes en `Mercadería` y `Asignaciones`.
4. Ajustar `Rendiciones` para mostrar datos operativos completos y CTA final explícito.
5. Verificación funcional y de accesibilidad en los flujos críticos.

## 9. Criterios de éxito

- El trabajador puede registrar su día sin confusión y con botón final claro.
- Buscar un producto entre 50 items es rápido sin dropdown extenso.
- Empresas son distinguibles de inmediato en listas y detalles.
- Lotes recientes son fáciles de ubicar por agrupación y numeración.
- No existe pestaña ni ruta activa de `Reportes`.

