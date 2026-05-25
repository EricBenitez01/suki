# Suki — Kyrax Technology

> Herramienta SaaS interna para importadores-vendedores de Mercado Libre Argentina.
> Calcula costos landed, optimiza precios, analiza salud del negocio y genera P&L real desde órdenes de ML.

**Prod:** https://suki-kyrax.vercel.app  
**Stack:** React 18 + Vite 5 · Supabase (auth + DB) · Vercel (SPA + Edge Functions) · ML API  
**Última actualización del README:** 25/05/2026

---

## Índice

1. [Arquitectura general](#arquitectura-general)
2. [Setup local](#setup-local)
3. [Deploy](#deploy)
4. [Módulos — qué hace cada pantalla](#módulos)
5. [Integración MercadoLibre](#integración-mercadolibre)
6. [API routes (Vercel Edge Functions)](#api-routes)
7. [Base de datos Supabase](#base-de-datos-supabase)
8. [localStorage — estado local](#localstorage)
9. [Patrones y convenciones importantes](#patrones-y-convenciones)
10. [User Journeys](#user-journeys)
11. [Backlog — qué falta hacer](#backlog)
12. [Gotchas y errores conocidos](#gotchas)

---

## Arquitectura general

```
Browser (React SPA)
  ├── Supabase Auth (email/password)
  ├── Supabase DB (simulaciones, productos, importaciones)
  ├── localStorage (ML cache, gastos fijos, ads manual, dark mode)
  └── Vercel Edge Functions (/api/*)
        ├── meli-callback.js   → OAuth 2.0 callback (intercambia code → token)
        ├── meli-refresh.js    → refresca access_token vencido
        ├── meli-proxy.js      → proxy GET a api.mercadolibre.com
        ├── meli-post.js       → proxy POST /items (publicar en ML)
        └── meli-notifications.js → webhook ML (sin usar todavía)
```

**Importante:** No hay SSR. Todo es client-side (Vite SPA) excepto las Edge Functions. Vercel sirve `index.html` para todas las rutas excepto `/api/*` y `/landing/*` (ver `vercel.json`).

---

## Setup local

```bash
# 1. Instalar (SSL roto en algunas redes corporativas)
npm install --strict-ssl=false

# 2. Variables de entorno
cp .env.example .env.local
# Completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
# (NO se necesitan las claves de ML en local — las Edge Functions las usan en Vercel)

# 3. Dev server
npm run dev
# → http://localhost:5173

# 4. Build
npm run build
```

### Variables de entorno

```env
# .env.local (nunca commitear)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Solo en Vercel (no en .env.local):
MELI_CLIENT_ID=395904959749315
MELI_CLIENT_SECRET=<secret>
```

Las variables `MELI_*` viven **solo en Vercel** (configuradas en el dashboard). Las Edge Functions las leen via `process.env`. El cliente React nunca toca el CLIENT_SECRET.

---

## Deploy

El deploy se hace via REST API de Vercel (no CLI para evitar problemas de PATH en Windows):

```bash
node deploy-vercel.mjs
```

El script sube todos los archivos fuente (no el `dist/`) y Vercel hace el build en la nube. El token de Vercel vive en:
- `deploy-vercel.mjs` (variable `TOKEN` al inicio del archivo)
- `C:\Users\HP\AppData\Roaming\xdg.data\com.vercel.cli\auth.json` (para el CLI local)

**Token:** no commitear — guardarlo solo en `deploy-vercel.mjs` (local) y en `auth.json` (local).  
Si el deploy devuelve 403, el token expiró — generá uno nuevo en https://vercel.com/account/tokens y actualizá ambos archivos.

---

## Módulos

### 🏠 Inicio (`InicioPanel.jsx`)
Setup guide progresivo basado en el estado real del usuario:
1. Conectar ML → `getMeliConnection()`
2. Sincronizar publicaciones → `getCachedItems()?.items?.length`
3. Cargar costos → `loadProductos()` con `costoUnitARS != null`

Muestra CTAs a Dashboard de Salud y P&L cuando hay datos suficientes. Quick access a Cotizador, Pricing, Importaciones, Historial.

---

### ⚖️ Cotizador de flete (`InputPanel.jsx` + `ResultsPanel.jsx`)
Calcula el **costo landed** para un producto importado desde China.

**Inputs clave:** FOB USD, unidades, peso, dimensiones, NCM, DI %, tipo de cambio.  
**Output:** comparativa aéreo (courier) vs marítimo (LCL) con desglose completo de impuestos y costos.

Motor de cálculo en `src/lib/calculations.js` — función principal `calcularComparativa(values)`. Los defaults (tasas, gastos fijos logísticos) están en `DEFAULTS`. Los impuestos aduaneros siguen la estructura argentina: `CIF + DI + TE` como base imponible para IVA, IVA adicional, Ganancias, IIBB.

Se puede guardar la simulación (→ Supabase `simulaciones`) y opcionalmente agregar el producto al Catálogo.

---

### 💰 Pricing ML (`PricingPanel.jsx`)
Calcula el precio de venta óptimo para ML a partir del costo landed.

**Fórmula:**
```
factor_neto = 1 - %ML - %Ads - %IVA - %IIBB - %Otros
precio_mínimo = costoUnitARS / factor_neto
precio_con_margen = costoUnitARS / (factor_neto - margen_target/100 * factor_neto)
```

Muestra tabla de 6 escenarios (de 10% a 50% de margen), punto de equilibrio, y permite ingresar precio directo para calcular margen resultante. Si hay un cotizador activo, toma el costo automáticamente.

---

### 🛍️ Catálogo (`CatalogoPanel.jsx`)
Lista de productos con costo cargado. Tabla + detalle expandido.

**Producto schema** (Supabase `productos` + `src/lib/db.js`):
```js
{
  id, nombre, sku,
  costoUnitARS, costoUnitUSD, costoSource,  // 'manual' | 'simulacion' | 'importacion'
  simulacionId, importacionId, importacionProductoId,
  mlItemId,           // ID de la publicación ML vinculada (e.g. "MLA123456")
  mlPct, adsPct, ivaPct, iibbPct, otrosPct,  // comisiones para calcular margen
  precioActual,       // precio ML efectivo (sale_price ?? price), sincronizado del cache ML
  createdAt, updatedAt
}
```

**Vista de detalle** incluye:
- Edición inline de todos los campos
- `MLItemSelector`: busca en el cache local de ML y vincula `mlItemId`
  - Usa `sale_price?.amount ?? price` para mostrar precio efectivo (con PROMO badge si hay descuento)
- **🚀 Publicar en ML ↗**: botón visible si ML está conectado y el producto no tiene `mlItemId`. Abre `PublicarMLModal`.
- Cálculo de margen: `effectivePrice = vinculoML.sale_price?.amount ?? vinculoML.price`
- Eliminación con modal de confirmación

---

### 📦 Importaciones (`ImportacionesPanel.jsx`)
Gestión de órdenes de importación multi-producto. Calcula el costo landed por producto dentro de una importación compartida (costos fijos prorrateados). Persiste en Supabase `importaciones`.

---

### 🛒 ML Publicaciones (`MLPublicacionesPanel.jsx`)
Grilla de publicaciones sincronizadas desde ML.

**Flujo:**
1. `syncMeliItems()` → carga items activos/pausados/finalizados → guarda en `localStorage('suki_meli_items_cache')`
2. Cada card muestra precio efectivo (`sale_price?.amount ?? price`), stock, estado
3. Badge **✓ Catálogo** si `productos.some(p => p.mlItemId === item.id)`
4. Botón **+ Cargar costo** → abre `CargarCostoModal`:
   - Pre-fills nombre (truncado a 60 chars), precio ML actual
   - Inputs: SKU (opcional), costo unitario ARS, %ML, %Ads, %IVA
   - Guarda con `addProducto({ ..., mlItemId: item.id })` → vincula automáticamente
5. Si ya tiene costo: muestra badge verde `✓ Costo: $X.XXX`
6. Click en card → vista de detalle del item ML con atributos, fotos, stock, etc.

**Auto-vincular** (`AutoVincularModal.jsx`): matching automático por nombre entre catálogo y publicaciones ML.

---

### 📊 Dashboard de Salud (`DashboardSaludPanel.jsx`)
Foto actual del negocio: margen real por producto vinculado a ML.

Para cada producto con `mlItemId`:
- Precio efectivo: `sale_price?.amount ?? price` del cache ML
- Margen = `(effectivePrice × factorNeto - costoUnitARS) / effectivePrice × 100`
- KPIs globales: revenue teórico, margen promedio ponderado, productos con margen positivo/negativo

**No usa órdenes reales** — usa el precio ML actual y el costo del catálogo. Para P&L real con ventas históricas, usar el módulo de P&L Mensual.

---

### 📈 P&L Mensual (`PLMensualPanel.jsx`)
Estado de resultados real del mes basado en **órdenes pagas de ML**.

**Flujo:**
1. Usuario selecciona mes (navegador ← →)
2. Click "Cargar P&L" → `fetchOrders(userId, token, from, to)`
   - Endpoint: `GET /orders/search?seller={id}&order.status=paid&sort=date_desc&...`
   - Paginado hasta 200 órdenes
3. Agrega por `item.id` → cruza con catálogo por `mlItemId === item.id` → obtiene `costoUnitARS`
4. Calcula: revenue, costo de ventas, ganancia bruta, margen%
5. Descuenta gastos fijos activos (`localStorage('suki_gastos_fijos')`) → ganancia operativa
6. Descuenta gasto en ML Ads (API o manual) → ganancia neta

**Sección ML Ads:**
- Botón "Importar de ML" → `fetchAdsSpend()` (2 endpoints, fallback graceful, ver `meli.js`)
- Si API no disponible (403/404): campo manual con persistencia por mes en `localStorage('suki_ads_mensual')` → key `{year}-{month}`
- Badge `✓ API ML` o `Ingresado manualmente`

**Waterfall en la UI:** Ganancia bruta → −cada gasto fijo → Ganancia operativa → −Ads → Ganancia neta (con colores pos/neg)

**Alertas automáticas:**
- "N publicaciones sin costo — el P&L subestima costos" + CTA a ML Publicaciones
- "Sin gastos fijos configurados" + CTA a Ajustes

---

### 📋 Historial (`HistorialPanel.jsx`)
Lista de simulaciones guardadas con opción de restaurar los inputs al Cotizador.

---

### ⚙️ Ajustes (`SettingsPanel.jsx`)

**Sección ML:** estado de conexión, desconectar, reconectar (link a `MELI_AUTH_URL`).

**Sección Gastos fijos mensuales** (`GastosFijosSection`):
- CRUD de ítems: `{ id: Date.now(), nombre, monto, activo: true }`
- Toggle activo/inactivo por ítem (útil para escenarios)
- Total automático calculado
- Persiste en `localStorage('suki_gastos_fijos')`
- Los gastos activos se descuentan en el P&L Mensual

**Sección Datos almacenados:** stats de Supabase (simulaciones, productos, importaciones), export/import JSON, clear data.

---

### 🚀 Publicar en ML (`PublicarMLModal.jsx`)
Modal accesible desde el detalle de producto en Catálogo cuando ML está conectado y el producto no tiene publicación vinculada.

**Campos:**
- Título (pre-filled con `producto.nombre`, max 60 chars)
- Precio ARS (pre-filled con `producto.precioActual`)
- Cantidad disponible
- Condición (nuevo/usado)
- Tipo de publicación (Gold Special recomendado / Gold Premium / Bronce / Gratis)
- Descripción (opcional)
- URL de imagen (opcional, HTTPS)
- Categoría ML: búsqueda via `/sites/MLA/domain_discovery/search?q=...` con auto-suggest del título (debounce 600ms)

**Publish:** POST `/items` via `api/meli-post.js` → devuelve `result.id` → callback `onPublished(result.id)` → `updateProducto({ mlItemId })` → vinculo automático.

**Requiere scope `write`** en el token ML. Si el usuario conectó ML antes del 25/05/2026, su token tiene solo `offline_access`. Debe desconectar y reconectar desde Ajustes para obtener el scope `write read`. Hay un banner de aviso en el modal.

---

## Integración MercadoLibre

### OAuth 2.0

```
App ML ID: 395904959749315
Redirect URI: https://suki-kyrax.vercel.app/api/meli-callback
Scopes: offline_access write read
```

**Flujo:**
1. Usuario hace click "Conectar con ML" → redirige a `MELI_AUTH_URL`
2. ML redirige a `/api/meli-callback?code=...`
3. `meli-callback.js` intercambia `code` por `access_token + refresh_token`
4. Callback redirige a `/?meli_ok=1&meli_at=...&meli_uid=...&meli_exp=...`
5. `App.jsx` lee los params, llama `saveMeliConnection()`, guarda en `localStorage('suki_meli_connection')`

**Token refresh:** automático en `getValidToken()`. Si el token expira en menos de 5 minutos, llama a `/api/meli-refresh?rt=...` antes de usarlo.

**Conexión guardada en localStorage:**
```js
{
  access_token: "APP_USR-...",
  refresh_token: "TG-...",
  user_id: "123456789",
  expires_at: 1748200000000  // Date.now() + expires_in * 1000
}
```

### Endpoints ML usados

| Endpoint | Uso |
|---|---|
| `GET /users/{id}/items/search?status=active&limit=50&offset=0` | Listar IDs de publicaciones (paginado) |
| `GET /items?ids=MLA1,MLA2,...` | Detalle de hasta 20 items por request |
| `GET /users/{id}` | Info del usuario (nickname) |
| `GET /orders/search?seller={id}&order.status=paid&sort=date_desc&limit=50&offset=0` | Órdenes pagas del mes (P&L) |
| `GET /sites/MLA/domain_discovery/search?q=...&limit=8` | Buscar categorías ML para publicar |
| `POST /items` | Crear publicación nueva |
| `GET /advertising/product_ads/ads/summary/billing?user_id=...&date_from=...&date_to=...` | Gasto en ads del mes (puede dar 403/404) |
| `GET /advertising/product_ads/reports/billing?...` | Fallback para gasto en ads |

**Precio efectivo:** Siempre usar `item.sale_price?.amount ?? item.price`. `sale_price` existe cuando hay una promoción activa; `price` es el precio tachado (anchor price). Ignorar `original_price` para márgenes — ese campo es histórico y no refleja el precio de cobro real.

### Datos guardados del cache ML

`localStorage('suki_meli_items_cache')`:
```js
{
  items: [...],      // array de items con todos sus campos
  synced_at: 1748200000000
}
```
TTL: 1 hora. `isCacheStale()` lo verifica. `syncMeliItems()` trae activos + pausados + finalizados.

---

## API routes

Todas las Edge Functions están en `/api/` y se despliegan en Vercel.

### `meli-proxy.js`
Proxy GET hacia `api.mercadolibre.com`. Recibe `?path=...` y header `x-meli-token`. Para endpoints públicos (categorías), token puede ser `'public'` — el proxy igual incluye el header, ML lo ignora para endpoints no autenticados.

### `meli-post.js`
Proxy POST para crear publicaciones. Recibe `x-meli-token` y body JSON. Redirige a `POST /items`.

### `meli-callback.js`
Callback OAuth. Variables de entorno requeridas: `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET`.

### `meli-refresh.js`
Refresh del access_token. Recibe `?rt=<refresh_token>`.

### `meli-notifications.js`
Webhook receiver de ML (notificaciones de cambios en items/orders). **No implementado todavía** — solo recibe y responde 200.

---

## Base de datos Supabase

**Auth:** email/password via Supabase Auth. Cada usuario tiene un perfil en `profiles(id, org_id, role)`. Multi-tenant: cada organización (`org_id`) tiene sus propios datos.

**RLS:** todas las tablas tienen Row Level Security habilitada via Supabase. Los queries van con el JWT del usuario autenticado.

### Tablas

#### `profiles`
```sql
id uuid (FK auth.users)
org_id uuid
role text  -- 'admin' | 'user'
```

#### `simulaciones`
```sql
id uuid
org_id uuid, user_id uuid
nombre text, notas text
ganador text  -- 'aereo' | 'maritimo'
inputs jsonb  -- todos los valores del formulario del cotizador
aereo jsonb   -- { totalUSD, totalARS, costoUnitUSD, costoUnitARS }
maritimo jsonb
created_at timestamptz
```

#### `productos`
```sql
id uuid
org_id uuid, user_id uuid
nombre text, sku text
ml_pct, ads_pct, iva_pct, iibb_pct, otros_pct  numeric
precio_actual numeric   -- precio ML efectivo (sale_price ?? price)
costo_unit_ars, costo_unit_usd  numeric
costo_source text  -- 'manual' | 'simulacion' | 'importacion'
simulacion_id uuid (FK simulaciones, nullable)
importacion_id uuid (FK importaciones, nullable)
importacion_producto_id int (nullable)
ml_item_id text  -- e.g. "MLA123456789" (nullable)
created_at, updated_at  timestamptz
```

#### `importaciones`
```sql
id uuid
org_id uuid, user_id uuid
form jsonb    -- datos globales de la importación (TC, DI, etc.)
productos jsonb  -- array de { id, nombre, fobUnit, unidades, pesoKg, di, ... }
created_at, updated_at  timestamptz
```

### Migraciones
`supabase/migrations/20260520_add_ml_item_id.sql` — agrega `ml_item_id` a `productos`.  
Schema completo en `supabase/schema.sql`.

---

## localStorage

| Clave | Contenido | Notas |
|---|---|---|
| `suki_meli_connection` | `{ access_token, refresh_token, user_id, expires_at }` | Token ML del usuario |
| `suki_meli_items_cache` | `{ items: [...], synced_at: timestamp }` | Cache de publicaciones ML, TTL 1 hora |
| `suki_gastos_fijos` | `[{ id, nombre, monto, activo }]` | Gastos fijos mensuales (Ajustes) |
| `suki_ads_mensual` | `{ "2026-4": 150000, "2026-5": 80000 }` | Gasto en ML Ads por mes. Key = `{year}-{month}` (month 0-indexed) |
| `suki_dark` | `"true"` o `"false"` | Tema oscuro |

---

## Patrones y convenciones

### Precio efectivo ML
**Siempre** usar `item.sale_price?.amount ?? item.price` en lugar de solo `item.price`.  
- `price` = precio tachado cuando hay promo (anchor price)
- `sale_price.amount` = precio real de cobro cuando hay promoción activa
- `original_price` = histórico, no usar para márgenes

Esto aplica en: `MLPublicacionesPanel`, `CatalogoPanel` (MLItemSelector + vinculoML), `DashboardSaludPanel`, `PLMensualPanel`.

### Lazy state initializer
Para cargar desde localStorage al montar:
```js
// Correcto — React llama la función UNA sola vez al montar
const [gastos, setGastos] = useState(loadGastosFijos)

// Incorrecto — evalúa en cada render (y llama a localStorage en cada render)
const [gastos, setGastos] = useState(loadGastosFijos())
```

### Cálculo de margen
```js
const factorNeto = 1 - mlPct/100 - adsPct/100 - ivaPct/100 - iibbPct/100 - otrosPct/100
const margenARS = effectivePrice * factorNeto - costoUnitARS
const margenPct = (margenARS / effectivePrice) * 100
```

### Estructura de cards ML (`ml-card-wrap`)
Las cards de publicaciones ML usan un div wrapper para poder agregar accionadores debajo sin que sean parte del botón principal:
```html
<div class="ml-card-wrap">
  <button class="ml-card"><!-- contenido card --></button>
  <div><!-- acciones: + Cargar costo / badge ✓ Costo --></div>
</div>
```
En CSS: `.ml-card-wrap .ml-card { border: none; border-radius: 0; }` y `hover { transform: none; box-shadow: none; }`.

### getMonthRange (PLMensualPanel)
La función `getMonthRange(year, month)` (month 0-indexed) retorna `from` y `to` en ISO con timezone `-03:00` (Argentina). La variable interna se llama `fmtDate` para no hacer shadow del `fmt` importado de `calculations.js`.

### Routing
Sin React Router. La navegación es un `useState('inicio')` en `App.jsx` que pasa `view` y `setView` como `onNavigate` a los paneles. Cualquier panel puede navegar a otro pasando el ID de la vista.

---

## User Journeys

### User A — "Ya tengo tienda ML, quiero ver qué gano"
```
Inicio → conectar ML → ML Publicaciones → Sincronizar
  → Por cada publicación: "+ Cargar costo"
    → mini-modal: nombre / costo / parámetros ML
    → guardado con mlItemId pre-seteado
  → Dashboard de Salud: márgenes en tiempo real por producto
  → P&L Mensual → "Cargar P&L": ganancia real del mes
    → Ajustes: cargar gastos fijos (alquiler, empleados, etc.)
    → P&L Mensual: ganancia operativa y neta reales
```

### User B — "Soy importador, quiero publicar y controlar márgenes"
```
Cotizador → simular costo landed (FOB, peso, DI, unidades)
  → Guardar → opcional: agregar a catálogo
  → Pricing ML → calcular precio óptimo según margen target
  → Catálogo → detalle de producto → "Publicar en ML ↗"
    → modal: título, foto, categoría, qty, tipo
    → POST /items → mlItemId vinculado automáticamente
  → ML Publicaciones: publicación aparece con badge ✓ Catálogo
  → Dashboard de Salud + P&L Mensual funcionan solos
```

---

## Backlog

### Alta prioridad

**Sync precio ML en catálogo al hacer sync**  
Cuando `syncMeliItems()` actualiza el cache, debería también actualizar `precio_actual` en Supabase para cada producto vinculado (`mlItemId`). Actualmente el precio en catálogo queda desactualizado si ML cambia el precio o activa una promo después del último sync manual.

**Export CSV para contador**  
Desde P&L Mensual — botón "Exportar CSV" que genere un archivo con las columnas: producto, unidades vendidas, revenue, costo, ganancia, margen%. Más totales y gastos fijos al pie. Útil para entregar al contador mensualmente.

**Defaults de comisiones en Ajustes**  
Exponer `%ML`, `%Ads`, `%IVA` como configuración global en SettingsPanel. Actualmente cada formulario (Cargar costo, Pricing, Save modal) tiene defaults hardcodeados. Si el usuario usa otro tipo de publicación o tiene acuerdo especial con ML, tiene que cambiarlos en cada form individualmente.

### Media prioridad

**ML Ads API — activación del scope**  
`/advertising/product_ads/ads/summary/billing` puede dar 403 si la cuenta no tiene Product Ads habilitado en el Developer Console de ML. Hace falta guía de activación o contactar a ML para habilitar el scope `advertising`. El workaround actual (input manual) funciona, pero no es ideal.

**Notificaciones ML webhook** (`api/meli-notifications.js`)  
El handler existe pero solo responde 200. Podría procesarse para auto-invalidar el cache y actualizar precios cuando ML notifica cambios en un item. Requiere configurar la URL en el Developer Console de ML.

**Multi-tienda ML**  
Soporte para múltiples cuentas ML conectadas (hoy solo una por sesión de browser). Útil para vendedores con varias cuentas o agencias que manejan clientes.

**Tabla de escenarios en P&L**  
"¿Qué pasa si subo el precio 10%?" o "¿Qué pasa si reduzco costos $X?" directamente desde el panel mensual.

**Historial de margen por producto**  
Gráfico de evolución del margen mes a mes para un producto. Requiere guardar snapshots del P&L o calcular retroactivamente con el historial de órdenes.

### Baja prioridad / exploratorio

**Migración a Next.js**  
El proyecto tiene 5 Edge Functions, auth, DB y múltiples integraciones. Next.js daría SSR, API routes nativas y mejor DX para integraciones futuras (Stripe para billing del SaaS, más OAuth providers). No urgente, pero considerar si se suman más integraciones o si se quiere escalar como producto.

**Multi-tenant con invitación**  
Hoy cada cuenta es un `org_id` solo. Falta el flujo de invitar colaboradores (empleado con rol `user` vs dueño con rol `admin`) con email de invitación.

**PWA / app mobile**  
La UI es responsive pero no fue optimizada para mobile. Si hay demanda, considerar PWA con service worker para cache offline.

---

## Gotchas

### ML Orders API — endpoint correcto
```
GET /orders/search?seller={userId}&order.status=paid&sort=date_desc&limit=50&offset=0
```
**NO** es `/users/{userId}/orders/search` — ese endpoint devuelve 404.

### ML Ads API — permiso de Product Ads
Los endpoints de Product Ads requieren que la app ML tenga el scope de "Advertising" habilitado en el developer console de ML. Si devuelve 403/404, la solución ya implementada es el input manual en el P&L Mensual con persistencia por mes.

### OAuth scope `write`
Si el usuario conectó ML antes del 25/05/2026, su `refresh_token` solo tiene scope `offline_access`. Para publicar en ML (POST /items) necesita `write`. Solución: desconectar desde Ajustes y volver a conectar. El banner en `PublicarMLModal.jsx` lo explica.

### Token Vercel expirado
Los tokens `vcp_*` tienen vencimiento. Si el deploy falla con 403, regenerar en https://vercel.com/account/tokens y actualizar:
1. Variable `TOKEN` en `deploy-vercel.mjs`
2. Campo `token` en `C:\Users\HP\AppData\Roaming\xdg.data\com.vercel.cli\auth.json`

### `npm install` con SSL
En redes con proxies/firewalls corporativos: `npm install --strict-ssl=false`

### Formato de fechas para ML Orders API
La API acepta ISO 8601 con timezone. Se usa `-03:00` (Argentina, sin DST):
```js
`${year}-${pad(month+1)}-${pad(day)}T00:00:00.000-03:00`
```

### `sale_price` vs `price` — impacto en P&L
Nunca usar `item.price` solo para calcular revenue o margen. ML cobra `sale_price.amount` cuando hay promoción activa. El `price` en ese caso es el precio tachado decorativo. Ignorar esto infla el margen calculado artificialmente.

---

## Estructura de archivos

```
suki/
├── api/
│   ├── meli-callback.js       # OAuth callback (intercambia code → tokens)
│   ├── meli-proxy.js          # GET proxy → ML API (todos los reads)
│   ├── meli-post.js           # POST proxy → ML API (publicar items)
│   ├── meli-refresh.js        # Refresh access_token vencido
│   └── meli-notifications.js  # Webhook ML (recibe pero no procesa todavía)
├── src/
│   ├── App.jsx                # Router (useState view), meli callback handler, TC fetch
│   ├── main.jsx               # Entry point React
│   ├── components/
│   │   ├── Header.jsx                  # Topbar: logo, dark mode, perfil, hamburger
│   │   ├── SideNav.jsx                 # Nav lateral: Inicio / ANÁLISIS / Herramientas
│   │   ├── InicioPanel.jsx             # Setup guide progresivo
│   │   ├── InputPanel.jsx              # Formulario cotizador
│   │   ├── ResultsPanel.jsx            # Comparativa aéreo/marítimo
│   │   ├── PricingPanel.jsx            # Calculadora pricing ML
│   │   ├── CatalogoPanel.jsx           # Catálogo de productos + Publicar en ML
│   │   ├── ImportacionesPanel.jsx      # Gestión de importaciones multi-producto
│   │   ├── MLPublicacionesPanel.jsx    # Grilla publicaciones ML + Cargar costo
│   │   ├── DashboardSaludPanel.jsx     # Salud del negocio (márgenes en tiempo real)
│   │   ├── PLMensualPanel.jsx          # P&L mensual desde órdenes ML reales
│   │   ├── PublicarMLModal.jsx         # Modal para crear publicación en ML
│   │   ├── AutoVincularModal.jsx       # Auto-matching catálogo ↔ ML por nombre
│   │   ├── HistorialPanel.jsx          # Historial de simulaciones guardadas
│   │   ├── SettingsPanel.jsx           # Ajustes: ML, gastos fijos, datos
│   │   ├── SaveModal.jsx               # Modal guardar simulación + agregar a catálogo
│   │   ├── ConfirmModal.jsx            # Modal confirmación genérico
│   │   ├── LoginPage.jsx               # Login con Supabase Auth
│   │   └── LandingPage.jsx             # Landing pública (sin usar en prod actualmente)
│   ├── lib/
│   │   ├── calculations.js    # Motor de cálculo flete + pricing + DEFAULTS
│   │   ├── calculations.test.js
│   │   ├── db.js              # CRUD Supabase (simulaciones, productos, importaciones)
│   │   ├── meli.js            # ML API client (auth, sync, orders, ads, categories, publish)
│   │   ├── supabase.js        # Init Supabase client
│   │   ├── productos.js       # Helpers productos (sin uso activo)
│   │   └── storage.js         # Helpers localStorage (sin uso activo)
│   ├── contexts/
│   │   ├── AuthContext.jsx    # Supabase auth session + profile
│   │   └── ToastContext.jsx   # Toast notifications globales
│   └── styles/
│       └── kyrax.css          # Design system completo (light/dark, todos los componentes)
├── supabase/
│   ├── schema.sql
│   └── migrations/20260520_add_ml_item_id.sql
├── public/
│   ├── favicon.svg
│   └── landing/index.html     # Landing estática pública
├── deploy-vercel.mjs          # Script de deploy via REST API Vercel
├── deploy-landing.mjs         # Script de deploy solo la landing
├── vercel.json                # Rewrites SPA (todo → index.html excepto /api/ y /landing/)
├── vite.config.js
└── package.json
```

---

Kyrax Technology · Buenos Aires, Argentina · 2026
