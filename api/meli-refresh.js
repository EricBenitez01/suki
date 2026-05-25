const CLIENT_ID = process.env.MELI_CLIENT_ID
const CLIENT_SECRET = process.env.MELI_CLIENT_SECRET

export default async function handler(req, res) {
  const { rt } = req.query || {}
  if (!rt) return res.status(400).json({ error: 'missing refresh_token' })

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: rt,
    })

    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params.toString(),
    })

    const data = await tokenRes.json()

    if (!data.access_token) {
      console.error('ML refresh error:', JSON.stringify(data))
      return res.status(401).json({ error: data.message || 'refresh_failed' })
    }

    return res.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    })
  } catch (err) {
    console.error('meli-refresh error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
