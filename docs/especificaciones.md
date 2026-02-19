# 📦 TRAZZIO — Especificaciones del Sistema
> Sistema de administración de ventas de conservas

---

## 1. VISIÓN GENERAL

Trazzio es una plataforma web responsive para gestionar el ciclo completo de ventas de conservas: desde la recepción de mercadería de proveedores, la asignación a trabajadores, la rendición diaria, hasta reportes de ganancias, inventario y merma.

**Usuarios:**
- **Administrador** — acceso completo desde desktop y móvil
- **Trabajadores** — acceso móvil-first para rendición diaria

---

## 2. STACK TECNOLÓGICO RECOMENDADO

| Capa | Tecnología | Razón |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Fullstack, SSR, mobile-friendly, un solo repo |
| Base de datos | **PostgreSQL** | Relacional, robusto para reportes complejos |
| ORM | **Prisma** | Type-safe, migraciones fáciles, compatible con Claude Code |
| Auth | **NextAuth.js** | Roles admin/worker, sesiones seguras |
| UI | **Tailwind CSS + shadcn/ui** | Responsive, mobile-first sin esfuerzo extra |
| Deploy | **Vercel** (frontend) + **Supabase o Railway** (BD) | Rápido, escalable |
| Estado | **React Query (TanStack)** | Sincronización de datos en tiempo real |

---

## 3. MÓDULOS DEL SISTEMA

### 3.1 MÓDULO ADMIN

#### 📦 Gestión de Empresas y Productos
- CRUD de empresas proveedoras
- CRUD de productos por empresa (nombre, precio costo, precio venta, unidades por caja, umbral stock bajo)
- Vista de catálogo por empresa

#### 🚚 Recepción de Mercadería
- Registrar ingreso de stock (producto, cantidad en cajas/unidades, fecha)
- El stock se suma automáticamente al inventario del producto

#### 👷 Gestión de Trabajadores
- CRUD de trabajadores (nombre, teléfono, comisión)
- Crear credenciales de acceso para cada trabajador

#### 📋 Asignación Diaria
- Seleccionar trabajador + productos + cantidades a asignar
- Puede asignar múltiples productos a un trabajador en un solo lote
- El stock disponible se descuenta al asignar

#### 💰 Revisión de Rendiciones
- Ver las rendiciones enviadas por trabajadores
- Confirmar o ajustar si hay diferencias
- Ver el historial de rendiciones

#### 📊 Reportes y Dashboard
- **Dashboard diario:** ventas del día, ganancia total, trabajadores pendientes de rendir
- **Reporte por trabajador:** ventas, merma, comisión, ganancia generada
- **Reporte por empresa/producto:** unidades vendidas, merma, stock actual
- **Inventario en tiempo real:** stock en unidades y cajas por producto/empresa
- **Stock bajo:** alertas de productos bajo el umbral definido con su empresa correspondiente
- **Merma:** cantidad de merma por producto y empresa en rangos de fecha
- **Ganancias por rango de fecha:** filtro por días/semanas/meses

---

### 4 MÓDULO TRABAJADOR (Mobile-first)

#### 📲 Pantalla Principal
- Ver los productos asignados del día con sus cantidades
- Estado de la rendición (pendiente / completada)

#### ✅ Rendición Diaria
1. Para cada producto asignado, ingresar **cantidad sobrante**
2. Ingresar **merma** (productos defectuosos): cantidad y motivo
3. El sistema calcula automáticamente: `vendido = asignado - sobrante - merma`
4. Ver el **total a pagar** (vendido × precio venta)
5. Confirmar y enviar rendición

---

## 5. FLUJO COMPLETO DEL NEGOCIO

```
[PROVEEDOR] 
    ↓ trae mercadería
[ADMIN registra ingreso de stock]
    ↓ stock disponible aumenta
[ADMIN asigna productos a trabajador(es)]
    ↓ stock disponible disminuye
[TRABAJADOR sale a vender durante el día]
    ↓ al final del día
[TRABAJADOR registra sobrante + merma en la app]
    ↓ sistema calcula vendido automáticamente
[TRABAJADOR entrega dinero exacto al admin]
    ↓
[ADMIN revisa rendición y confirma]
    ↓
[Sistema actualiza inventario, ganancias y reportes]
```

**Lógica de merma:**
- La merma se descuenta del total vendido (no se cobra al trabajador)
- Ajusta el inventario (se anota como pérdida/devolución a empresa)
- Queda registrada en reportes por producto/empresa

---

## 6. REGLAS DE NEGOCIO

1. Un trabajador solo puede tener una rendición pendiente activa por día
2. El precio de venta lo define únicamente el admin y no puede ser modificado por el trabajador
3. El stock bajo se configura por producto y el admin define el umbral (ej: 50 unidades)
4. La merma reduce las unidades vendidas y por tanto el dinero a rendir
5. El inventario se actualiza en tiempo real al asignar y al cerrar rendiciones
6. El sistema maneja stock en **unidades**, pero muestra equivalente en **cajas** según `unitPerBox`

## 7. CONSIDERACIONES TÉCNICAS

- **Moneda:** Decimal con 2 decimales, mostrar siempre con símbolo S/
- **Fechas:** Usar `date-fns` con locale `es-PE`, zona horaria America/Lima
- **Stock:** Siempre en unidades internamente; mostrar en cajas para UX
- **Comisión:** Soporte para dos tipos: porcentaje (%) o monto fijo (S/ por día)
- **Escalabilidad:** El modelo está preparado para multi-tenant (agregar `organizationId` a modelos principales en el futuro)
- **PWA:** Configurar `next-pwa` para que trabajadores puedan instalar la app en su celular
- **Seguridad:** Middleware de Next.js valida rol en cada ruta; trabajador solo ve sus propios datos

---

**Tips para usar con Claude Code:**
- Usa los prompts en orden (1 → 8)
- Antes de cada prompt, haz `claude` en la carpeta del proyecto
- Si un prompt es muy largo, Claude Code puede pedirte confirmación antes de empezar a escribir
- Agrega al final de cada prompt: *"Asegúrate de que el código compile sin errores antes de terminar"*
- Para el schema de Prisma en el Prompt 1, pega el schema de la Sección 3 de este documento