import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

const LOGO_PATH = 'M107.148 0L148.169 55.3448L107.148 110.69H188.675L148.169 55.3448L188.675 0H107.148ZM0 0L40.5216 55.3448L0 110.69H81.5271L40.5216 55.3448L81.5271 0H0ZM188.675 110.69H296L255.478 55.3448L296 0H188.675L229.196 55.3448L188.675 110.69Z'

function KyraxLogo({ width = 72 }) {
  const h = Math.round(width * 111 / 296)
  return (
    <svg width={width} height={h} viewBox="0 0 296 111" fill="none">
      <defs>
        <linearGradient id="lg-login" x1="0" y1="0" x2="296" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0C0819" />
          <stop offset="1" stopColor="#4601FA" />
        </linearGradient>
      </defs>
      <path d={LOGO_PATH} fill="url(#lg-login)" />
    </svg>
  )
}

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [orgCode, setOrgCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [confirmMsg, setConfirmMsg] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else {
        if (!nombre.trim()) throw new Error('El nombre es requerido.')
        const { error } = await signUp(email, password, nombre.trim(), orgCode.trim() || null)
        if (error) throw error
        setConfirmMsg('Revisá tu email para confirmar la cuenta.')
      }
    } catch (err) {
      setError(translateError(err.message))
    } finally {
      setLoading(false)
    }
  }

  if (confirmMsg) {
    return (
      <div className="login-page">
        <div className="login-box">
          <KyraxLogo />
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📬</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Confirmá tu email</div>
            <div style={{ color: 'var(--ink-mute)', fontSize: 13 }}>{confirmMsg}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <KyraxLogo />
          <div className="login-brand">Suki</div>
          <div className="login-tagline">Plataforma de importaciones · Kyrax Technology</div>
        </div>

        <div className="login-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null) }}>
            Ingresar
          </button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(null) }}>
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nombre</label>
              <input className="form-input" type="text" placeholder="Tu nombre" value={nombre}
                onChange={e => setNombre(e.target.value)} required autoFocus />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="tu@email.com" value={email}
              onChange={e => setEmail(e.target.value)} required autoFocus={mode === 'login'} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Contraseña</label>
            <input className="form-input" type="password" placeholder="Mínimo 6 caracteres" value={password}
              onChange={e => setPassword(e.target.value)} required />
          </div>

          {mode === 'signup' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Código de equipo <span style={{ fontWeight: 400, color: 'var(--ink-mute)' }}>(opcional)</span></label>
              <input className="form-input mono" placeholder="Pegá el código que te compartió el admin"
                value={orgCode} onChange={e => setOrgCode(e.target.value)} />
              <p className="form-hint">Sin código → se crea un equipo nuevo y sos admin.</p>
            </div>
          )}

          {error && (
            <div style={{ background: 'var(--neg-bg)', color: 'var(--neg)', border: '1px solid var(--neg)', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button className="btn-sm primary" type="submit" disabled={loading}
            style={{ marginTop: 4, padding: '10px', fontSize: 14 }}>
            {loading ? 'Cargando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}

function translateError(msg) {
  if (msg.includes('Invalid login')) return 'Email o contraseña incorrectos.'
  if (msg.includes('Email not confirmed')) return 'Confirmá tu email antes de ingresar.'
  if (msg.includes('User already registered')) return 'Ya existe una cuenta con ese email.'
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  return msg
}
