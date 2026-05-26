/**
 * Inyecta datos mock de ML en el localStorage del browser.
 * Permite testear ML Publicaciones, Dashboard, P&L sin OAuth real.
 */

export const MOCK_ML_ITEMS = [
  {
    id: 'MLA1000000001',
    title: 'Camara Deportiva Acuatica 4K Ultra HD',
    price: 89999,
    sale_price: null,
    available_quantity: 12,
    sold_quantity: 45,
    status: 'active',
    condition: 'new',
    listing_type_id: 'gold_special',
    seller_sku: 'CAMARA-DEPORTIVA',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_test1.jpg',
    permalink: 'https://www.mercadolibre.com.ar/test1',
    shipping: { free_shipping: true },
    category_id: 'MLA1144',
    attributes: [{ id: 'SELLER_SKU', name: 'SKU Vendedor', value_name: 'CAMARA-DEPORTIVA' }],
    pictures: [],
  },
  {
    id: 'MLA1000000002',
    title: 'Teclado Mecanico RGB Gamer Retroiluminado',
    price: 49999,
    sale_price: { amount: 44999, currency_id: 'ARS' },
    available_quantity: 3,
    sold_quantity: 28,
    status: 'active',
    condition: 'new',
    listing_type_id: 'gold_special',
    seller_sku: 'TECLADO-RGB',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_test2.jpg',
    permalink: 'https://www.mercadolibre.com.ar/test2',
    shipping: { free_shipping: true },
    category_id: 'MLA1694',
    attributes: [{ id: 'SELLER_SKU', name: 'SKU Vendedor', value_name: 'TECLADO-RGB' }],
    pictures: [],
  },
  {
    id: 'MLA1000000003',
    title: 'Memoria MicroSD 128GB Clase 10 A2',
    price: 18999,
    sale_price: null,
    available_quantity: 0,
    sold_quantity: 130,
    status: 'active',
    condition: 'new',
    listing_type_id: 'bronze',
    seller_sku: 'MEMORIA-128GB',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_test3.jpg',
    permalink: 'https://www.mercadolibre.com.ar/test3',
    shipping: { free_shipping: false },
    category_id: 'MLA1693',
    attributes: [],
    pictures: [],
  },
  {
    id: 'MLA1000000004',
    title: 'Funda Protectora iPad 10ma Generacion con Teclado',
    price: 35000,
    sale_price: null,
    available_quantity: 8,
    sold_quantity: 19,
    status: 'paused',
    condition: 'new',
    listing_type_id: 'gold_special',
    seller_sku: 'FUNDA-IPAD',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_test4.jpg',
    permalink: 'https://www.mercadolibre.com.ar/test4',
    shipping: { free_shipping: true },
    category_id: 'MLA1051',
    attributes: [],
    pictures: [],
  },
  {
    id: 'MLA1000000005',
    title: 'Anillo Magnetico Magsafe Universal Smartphones',
    price: 12999,
    sale_price: null,
    available_quantity: 25,
    sold_quantity: 67,
    status: 'active',
    condition: 'new',
    listing_type_id: 'gold_special',
    seller_sku: 'ANILLO-MAGNETICO',
    thumbnail: 'https://http2.mlstatic.com/D_NQ_NP_test5.jpg',
    permalink: 'https://www.mercadolibre.com.ar/test5',
    shipping: { free_shipping: false },
    category_id: 'MLA1051',
    attributes: [],
    pictures: [],
  },
]

export const MOCK_ML_CONNECTION = {
  access_token: 'TEST_TOKEN_MOCK',
  refresh_token: 'TEST_REFRESH_MOCK',
  user_id: '2475937761',
  expires_at: Date.now() + 6 * 60 * 60 * 1000, // 6 horas
}

/** Inyecta la conexión ML y el cache de items en el browser */
export async function injectMLMock(page) {
  await page.evaluate(({ conn, items }) => {
    localStorage.setItem('suki_meli_connection', JSON.stringify(conn))
    localStorage.setItem('suki_meli_items_cache', JSON.stringify({
      items,
      synced_at: Date.now(),
    }))
  }, { conn: MOCK_ML_CONNECTION, items: MOCK_ML_ITEMS })
  await page.reload()
  await page.waitForSelector('.app-shell', { timeout: 15_000 })
}

/** Limpia el mock de ML */
export async function clearMLMock(page) {
  await page.evaluate(() => {
    localStorage.removeItem('suki_meli_connection')
    localStorage.removeItem('suki_meli_items_cache')
  })
}
