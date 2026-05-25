const STORAGE_KEY = 'suki_meli_connection'
const CACHE_KEY = 'suki_meli_items_cache'
const CACHE_TTL = 60 * 60 * 1000 // 1 hora
const CLIENT_ID = '395904959749315'
const REDIRECT_URI = 'https://suki-kyrax.vercel.app/api/meli-callback'

// write scope needed for POST /items (publicar)
export const MELI_AUTH_URL =
  `https://auth.mercadolibre.com.ar/authorization?response_type=code` +
  `&client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=offline_access%20write%20read`

export function getMeliConnection() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
}

export function saveMeliConnection(conn) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conn))
}

export function clearMeliConnection() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(CACHE_KEY)
}

export async function getValidToken() {
  const conn = getMeliConnection()
  if (!conn?.access_token) return null
  if (Date.now() < conn.expires_at - 300_000) return conn.access_token
  // refresh
  try {
    const res = await fetch(`/api/meli-refresh?rt=${encodeURIComponent(conn.refresh_token)}`)
    if (!res.ok) { clearMeliConnection(); return null }
    const data = await res.json()
    const updated = {
      ...conn,
      access_token: data.access_token,
      refresh_token: data.refresh_token || conn.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    }
    saveMeliConnection(updated)
    return updated.access_token
  } catch {
    return conn.access_token // use stale token as fallback
  }
}

async function meliGet(path, token) {
  const res = await fetch(`/api/meli-proxy?path=${encodeURIComponent(path)}`, {
    headers: { 'x-meli-token': token },
  })
  if (!res.ok) throw new Error(`ML API ${res.status}: ${path}`)
  return res.json()
}

export async function fetchAllItemIds(userId, token, status = 'active') {
  const ids = []
  let offset = 0
  const limit = 50
  while (true) {
    const data = await meliGet(
      `/users/${userId}/items/search?status=${status}&limit=${limit}&offset=${offset}`,
      token
    )
    ids.push(...(data.results || []))
    const total = data.paging?.total || 0
    offset += limit
    if (offset >= total || offset >= 200) break // cap at 200 items
  }
  return ids
}

export async function fetchItemsDetail(ids, token) {
  const items = []
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20)
    const data = await meliGet(`/items?ids=${chunk.join(',')}`, token)
    for (const entry of data) {
      if (entry.code === 200 && entry.body) items.push(entry.body)
    }
  }
  return items
}

export async function fetchUserInfo(userId, token) {
  try { return await meliGet(`/users/${userId}`, token) } catch { return null }
}

export async function syncMeliItems(userId, token, statuses = ['active', 'paused', 'closed']) {
  const allIds = []
  for (const status of statuses) {
    const ids = await fetchAllItemIds(userId, token, status)
    allIds.push(...ids)
  }
  const items = await fetchItemsDetail(allIds, token)
  const cache = { items, synced_at: Date.now() }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  return items
}

export async function fetchOrders(userId, token, from, to) {
  const orders = []
  let offset = 0
  const limit = 50
  while (true) {
    const data = await meliGet(
      `/orders/search?seller=${userId}&order.status=paid` +
      `&order.date_closed.from=${encodeURIComponent(from)}` +
      `&order.date_closed.to=${encodeURIComponent(to)}` +
      `&sort=date_desc` +
      `&limit=${limit}&offset=${offset}`,
      token
    )
    orders.push(...(data.results || []))
    const total = data.paging?.total || 0
    offset += limit
    if (offset >= total || offset >= 200) break
  }
  return orders
}

export async function createMLItem(itemData, token) {
  const res = await fetch('/api/meli-post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-meli-token': token },
    body: JSON.stringify(itemData),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `ML API error ${res.status}`)
  }
  return res.json()
}

export async function searchMLCategories(query) {
  const res = await fetch(`/api/meli-proxy?path=${encodeURIComponent(`/sites/MLA/domain_discovery/search?q=${encodeURIComponent(query)}&limit=8`)}`, {
    headers: { 'x-meli-token': 'public' },
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

// Gasto en ads del mes. Intenta la API de Product Ads de ML.
// Retorna { total, source: 'api'|'unavailable' } o null si hay error de auth.
export async function fetchAdsSpend(userId, token, dateFrom, dateTo) {
  // dateFrom / dateTo: 'YYYY-MM-DD'
  try {
    const path = `/advertising/product_ads/ads/summary/billing?user_id=${userId}&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`
    const res = await fetch(`/api/meli-proxy?path=${encodeURIComponent(path)}`, {
      headers: { 'x-meli-token': token },
    })
    if (res.status === 403 || res.status === 401) return { total: null, source: 'no_permission' }
    if (res.status === 404) {
      // Intentar endpoint alternativo
      const path2 = `/advertising/product_ads/reports/billing?user_id=${userId}&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`
      const res2 = await fetch(`/api/meli-proxy?path=${encodeURIComponent(path2)}`, {
        headers: { 'x-meli-token': token },
      })
      if (!res2.ok) return { total: null, source: 'unavailable' }
      const d2 = await res2.json()
      const total = d2.total_amount ?? d2.amount ?? d2.total ?? null
      return { total, source: total != null ? 'api' : 'unavailable' }
    }
    if (!res.ok) return { total: null, source: 'unavailable' }
    const data = await res.json()
    // Diferentes shapes según versión de API
    const total = data.total_amount ?? data.amount ?? data.total ?? data.costs?.total ?? null
    return { total, source: total != null ? 'api' : 'unavailable' }
  } catch {
    return { total: null, source: 'unavailable' }
  }
}

export function getCachedItems() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    return cache
  } catch { return null }
}

export function isCacheStale() {
  const cache = getCachedItems()
  if (!cache) return true
  return Date.now() - cache.synced_at > CACHE_TTL
}
