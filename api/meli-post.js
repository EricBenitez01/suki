export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const token = req.headers['x-meli-token']
  if (!token) return res.status(401).json({ error: 'missing token' })

  const { path = '/items', ...body } = req.body || {}

  try {
    const url = `https://api.mercadolibre.com${path}`
    const mlRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await mlRes.json()
    res.status(mlRes.status).json(data)
  } catch (err) {
    console.error('meli-post error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
