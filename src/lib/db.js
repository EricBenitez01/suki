import { supabase } from './supabase.js'

// ─── Context cache (evita re-fetching org_id en cada operación) ───────────────
let _ctx = null

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') _ctx = null
})

async function getCtx() {
  if (_ctx) return _ctx
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()
  _ctx = { userId: user.id, orgId: profile?.org_id, role: profile?.role }
  return _ctx
}

export function clearCtxCache() { _ctx = null }

// ─── Simulaciones ─────────────────────────────────────────────────────────────
export async function loadSimulaciones() {
  const { data, error } = await supabase
    .from('simulaciones')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return (data || []).map(row => ({
    id: row.id,
    nombre: row.nombre,
    notas: row.notas || '',
    fecha: row.created_at,
    inputs: row.inputs,
    ganador: row.ganador,
    aereo: row.aereo,
    maritimo: row.maritimo,
  }))
}

export async function saveSimulacion(inputs, results, titulo, notas) {
  const ctx = await getCtx()
  if (!ctx) throw new Error('No autenticado')
  const ganador = results.aereo.totalUSD <= results.maritimo.totalUSD ? 'aereo' : 'maritimo'
  const { data, error } = await supabase
    .from('simulaciones')
    .insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      nombre: (titulo || inputs.producto || 'Sin nombre').trim(),
      notas: notas || '',
      ganador,
      inputs,
      aereo: {
        totalUSD: results.aereo.totalUSD,
        totalARS: results.aereo.totalARS,
        costoUnitUSD: results.aereo.costoUnitUSD,
        costoUnitARS: results.aereo.costoUnitARS,
      },
      maritimo: {
        totalUSD: results.maritimo.totalUSD,
        totalARS: results.maritimo.totalARS,
        costoUnitUSD: results.maritimo.costoUnitUSD,
        costoUnitARS: results.maritimo.costoUnitARS,
      },
    })
    .select()
    .single()
  if (error) throw error
  return { ...data, fecha: data.created_at }
}

export async function deleteSimulacion(id) {
  const { error } = await supabase.from('simulaciones').delete().eq('id', id)
  if (error) throw error
}

export async function clearSimulaciones() {
  const ctx = await getCtx()
  if (!ctx) return
  const { error } = await supabase.from('simulaciones').delete().eq('org_id', ctx.orgId)
  if (error) throw error
}

// ─── Productos ────────────────────────────────────────────────────────────────
export async function loadProductos() {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return (data || []).map(rowToProducto)
}

function rowToProducto(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    sku: row.sku || '',
    mlPct: row.ml_pct,
    adsPct: row.ads_pct,
    ivaPct: row.iva_pct,
    iibbPct: row.iibb_pct,
    otrosPct: row.otros_pct,
    precioActual: row.precio_actual,
    costoUnitARS: row.costo_unit_ars,
    costoUnitUSD: row.costo_unit_usd,
    costoSource: row.costo_source,
    simulacionId: row.simulacion_id,
    importacionId: row.importacion_id,
    importacionProductoId: row.importacion_producto_id,
    mlItemId: row.ml_item_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function addProducto(data) {
  const ctx = await getCtx()
  if (!ctx) throw new Error('No autenticado')
  const { data: row, error } = await supabase
    .from('productos')
    .insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      nombre: data.nombre,
      sku: data.sku || '',
      ml_pct: data.mlPct ?? 25,
      ads_pct: data.adsPct ?? 12,
      iva_pct: data.ivaPct ?? 14,
      iibb_pct: data.iibbPct ?? 0,
      otros_pct: data.otrosPct ?? 0,
      precio_actual: data.precioActual ?? null,
      costo_unit_ars: data.costoUnitARS ?? null,
      costo_unit_usd: data.costoUnitUSD ?? null,
      costo_source: data.costoSource ?? 'manual',
      simulacion_id: data.simulacionId ?? null,
      importacion_id: data.importacionId ?? null,
      importacion_producto_id: data.importacionProductoId ?? null,
      ml_item_id: data.mlItemId ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return rowToProducto(row)
}

export async function updateProducto(id, changes) {
  const payload = { updated_at: new Date().toISOString() }
  const map = {
    nombre: 'nombre', sku: 'sku',
    mlPct: 'ml_pct', adsPct: 'ads_pct', ivaPct: 'iva_pct',
    iibbPct: 'iibb_pct', otrosPct: 'otros_pct',
    precioActual: 'precio_actual',
    costoUnitARS: 'costo_unit_ars', costoUnitUSD: 'costo_unit_usd',
    costoSource: 'costo_source',
    simulacionId: 'simulacion_id',
    importacionId: 'importacion_id',
    importacionProductoId: 'importacion_producto_id',
    mlItemId: 'ml_item_id',
  }
  for (const [k, col] of Object.entries(map)) {
    if (changes[k] !== undefined) payload[col] = changes[k]
  }
  const { error } = await supabase.from('productos').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteProducto(id) {
  const { error } = await supabase.from('productos').delete().eq('id', id)
  if (error) throw error
}

// ─── Importaciones ────────────────────────────────────────────────────────────
export async function loadImportaciones() {
  const { data, error } = await supabase
    .from('importaciones')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return (data || []).map(row => ({
    id: row.id,
    form: row.form,
    productos: row.productos || [],
  }))
}

export async function saveImportacion(existingId, form, productos) {
  if (existingId) {
    const { error } = await supabase
      .from('importaciones')
      .update({ form, productos, updated_at: new Date().toISOString() })
      .eq('id', existingId)
    if (error) throw error
    return existingId
  }
  const ctx = await getCtx()
  if (!ctx) throw new Error('No autenticado')
  const { data, error } = await supabase
    .from('importaciones')
    .insert({ org_id: ctx.orgId, user_id: ctx.userId, form, productos })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function deleteImportacion(id) {
  const { error } = await supabase.from('importaciones').delete().eq('id', id)
  if (error) throw error
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export async function getStats() {
  const [sims, prods, imps] = await Promise.all([
    supabase.from('simulaciones').select('id', { count: 'exact', head: true }),
    supabase.from('productos').select('id', { count: 'exact', head: true }),
    supabase.from('importaciones').select('id', { count: 'exact', head: true }),
  ])
  return {
    simulaciones: sims.count ?? 0,
    productos: prods.count ?? 0,
    importaciones: imps.count ?? 0,
  }
}

// ─── Export / Import ──────────────────────────────────────────────────────────
export async function exportarTodo() {
  const [sims, prods, imps] = await Promise.all([
    loadSimulaciones(),
    loadProductos(),
    loadImportaciones(),
  ])
  const blob = new Blob([JSON.stringify({ simulaciones: sims, productos: prods, importaciones: imps }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `suki_backup_${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importarTodo(file) {
  const text = await file.text()
  const backup = JSON.parse(text)
  const ctx = await getCtx()
  if (!ctx) throw new Error('No autenticado')

  if (backup.simulaciones?.length) {
    const rows = backup.simulaciones.map(s => ({
      org_id: ctx.orgId, user_id: ctx.userId,
      nombre: s.nombre, notas: s.notas || '',
      ganador: s.ganador, inputs: s.inputs,
      aereo: s.aereo, maritimo: s.maritimo,
    }))
    const { error } = await supabase.from('simulaciones').insert(rows)
    if (error) throw error
  }
  if (backup.importaciones?.length) {
    const rows = backup.importaciones.map(i => ({
      org_id: ctx.orgId, user_id: ctx.userId,
      form: i.form, productos: i.productos,
    }))
    const { error } = await supabase.from('importaciones').insert(rows)
    if (error) throw error
  }
  if (backup.productos?.length) {
    const rows = backup.productos.map(p => ({
      org_id: ctx.orgId, user_id: ctx.userId,
      nombre: p.nombre, sku: p.sku || '',
      ml_pct: p.mlPct ?? 25, ads_pct: p.adsPct ?? 12,
      iva_pct: p.ivaPct ?? 14, iibb_pct: p.iibbPct ?? 0, otros_pct: p.otrosPct ?? 0,
      precio_actual: p.precioActual ?? null,
      costo_unit_ars: p.costoUnitARS ?? null, costo_unit_usd: p.costoUnitUSD ?? null,
      costo_source: p.costoSource ?? 'manual',
    }))
    const { error } = await supabase.from('productos').insert(rows)
    if (error) throw error
  }
}
