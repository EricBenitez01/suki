const CLIENT_ID = process.env.MELI_CLIENT_ID
const CLIENT_SECRET = process.env.MELI_CLIENT_SECRET
const REDIRECT_URI = 'https://suki-kyrax.vercel.app/api/meli-callback'
const APP_URL = 'https://suki-kyrax.vercel.app'

export default async function handler(req, res) {
  const { code, error } = req.query || {}

  if (error || !code) {
    return res.redirect(302, `${APP_URL}/?meli_error=${encodeURIComponent(error || 'no_code')}`)
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    })

    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params.toString(),
    })

    const data = await tokenRes.json()

    if (!data.access_token) {
      console.error('ML token error:', JSON.stringify(data))
      return res.redirect(302, `${APP_URL}/?meli_error=${encodeURIComponent(data.message || 'token_error')}`)
    }

    const expiresAt = Date.now() + data.expires_in * 1000
    const qs = new URLSearchParams({
      meli_ok: '1',
      meli_at: data.access_token,
      meli_rt: data.refresh_token || '',
      meli_uid: String(data.user_id),
      meli_exp: String(expiresAt),
    })

    return res.redirect(302, `${APP_URL}/?${qs.toString()}`)
  } catch (err) {
    console.error('meli-callback error:', err.message)
    return res.redirect(302, `${APP_URL}/?meli_error=${encodeURIComponent(err.message)}`)
  }
}
