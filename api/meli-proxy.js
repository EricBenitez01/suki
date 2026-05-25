export default async function handler(req, res) {
  const { path } = req.query
  if (!path) return res.status(400).json({ error: 'missing path' })

  const token = req.headers['x-meli-token']
  if (!token) return res.status(401).json({ error: 'missing token' })

  try {
    const url = `https://api.mercadolibre.com${path}`
    const mlRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    const data = await mlRes.json()
    res.status(mlRes.status).json(data)
  } catch (err) {
    console.error('meli-proxy error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
