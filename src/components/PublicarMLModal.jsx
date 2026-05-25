import { useState, useEffect } from 'react'
import { getValidToken, searchMLCategories, createMLItem, getMeliConnection } from '../lib/meli.js'
import { useToast } from '../contexts/ToastContext.jsx'

const LISTING_TYPES = [
  { id: 'gold_special', label: 'Gold Special (recomendado)' },
  { id: 'gold_premium', label: 'Gold Premium' },
  { id: 'bronze', label: 'Bronce' },
  { id: 'free', label: 'Gratis' },
]

export default function PublicarMLModal({ producto, onClose, onPublished }) {
  const showToast = useToast()
  // Chequear si la conexión actual tiene scope write
  // Si el token fue obtenido antes del update de scope, puede fallar con 403
  const conn = getMeliConnection()

  const [title, setTitle] = useState(producto?.nombre || '')
  const [price, setPrice] = useState(producto?.precioActual ? String(Math.round(producto.precioActual)) : '')
  const [qty, setQty] = useState('1')
  const [condition, setCondition] = useState('new')
  const [listingType, setListingType] = useState('gold_special')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const [catQuery, setCatQuery] = useState('')
  const [catResults, setCatResults] = useState([])
  const [catLoading, setCatLoading] = useState(false)
  const [selectedCat, setSelectedCat] = useState(null)

  const [publishing, setPublishing] = useState(false)
  const [fieldError, setFieldError] = useState(null)

  // Auto-search category from title
  useEffect(() => {
    if (!title || title.length < 4) return
    const t = setTimeout(async () => {
      setCatLoading(true)
      try {
        const results = await searchMLCategories(title)
        setCatResults(results)
        if (results.length > 0 && !selectedCat) setSelectedCat(results[0])
      } catch { /* ignore */ }
      finally { setCatLoading(false) }
    }, 600)
    return () => clearTimeout(t)
  }, [title, selectedCat])

  const handleCatSearch = async () => {
    if (!catQuery) return
    setCatLoading(true)
    try {
      const results = await searchMLCategories(catQuery)
      setCatResults(results)
    } catch { /* ignore */ }
    finally { setCatLoading(false) }
  }

  const handlePublish = async () => {
    setFieldError(null)
    if (!title.trim()) return setFieldError('El título es obligatorio.')
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) return setFieldError('Ingresá un precio válido.')
    if (!selectedCat) return setFieldError('Seleccioná una categoría de ML.')
    if (!qty || isNaN(parseInt(qty)) || parseInt(qty) <= 0) return setFieldError('La cantidad debe ser mayor a 0.')

    setPublishing(true)
    try {
      const token = await getValidToken()
      if (!token) throw new Error('Token ML expirado — reconectá tu cuenta en Ajustes.')

      const payload = {
        title: title.trim(),
        category_id: selectedCat.category_id || selectedCat.id,
        price: parseFloat(price),
        currency_id: 'ARS',
        available_quantity: parseInt(qty),
        buying_mode: 'buy_it_now',
        condition,
        listing_type_id: listingType,
        ...(description.trim() && { description: { plain_text: description.trim() } }),
        ...(imageUrl.trim() && { pictures: [{ source: imageUrl.trim() }] }),
      }

      const result = await createMLItem(payload, token)
      if (!result.id) throw new Error(result.message || 'Error al publicar en ML')

      showToast(`✓ Publicado en ML: ${result.id}`, 'success')
      onPublished?.(result.id)
      onClose()
    } catch (err) {
      setFieldError(err.message)
      showToast(`Error: ${err.message}`, 'error')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <span style={{ fontWeight: 700, fontSize: 16 }}>Publicar en MercadoLibre</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 0 0' }}>

          {/* Aviso scope write */}
          <div style={{ padding: '9px 12px', background: 'var(--warn-bg)', border: '1px solid var(--warn)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--warn)' }}>
            ⚠️ Para publicar, tu cuenta ML debe tener autorización de <strong>escritura</strong>.
            Si obtenés un error 403, desconectá ML desde Ajustes y volvé a conectar para otorgar el permiso.
          </div>

          {/* Título */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Título de la publicación <span>*</span></label>
            <input
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Auriculares Bluetooth JBL Tune 510BT"
              maxLength={60}
            />
            <p className="form-hint">{title.length}/60 caracteres · ML recomienda ser descriptivo</p>
          </div>

          {/* Precio y cantidad */}
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Precio ARS <span>*</span></label>
              <input
                className="form-input mono"
                type="number"
                min="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Cantidad disponible <span>*</span></label>
              <input
                className="form-input mono"
                type="number"
                min="1"
                value={qty}
                onChange={e => setQty(e.target.value)}
              />
            </div>
          </div>

          {/* Condición y tipo */}
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Condición</label>
              <select className="form-input" value={condition} onChange={e => setCondition(e.target.value)}>
                <option value="new">Nuevo</option>
                <option value="used">Usado</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tipo de publicación</label>
              <select className="form-input" value={listingType} onChange={e => setListingType(e.target.value)}>
                {LISTING_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Categoría */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Categoría ML <span>*</span></label>
            {selectedCat && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--pos-bg)', border: '1px solid var(--pos)',
                borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 6,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                  ✓ {selectedCat.domain_name || selectedCat.category_name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-mute)', fontFamily: 'var(--font-mono)' }}>
                  {selectedCat.category_id || selectedCat.id}
                </span>
                <button className="btn-sm" onClick={() => setSelectedCat(null)}>✕</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="form-input"
                placeholder="Buscar categoría…"
                value={catQuery}
                onChange={e => setCatQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCatSearch()}
                style={{ flex: 1 }}
              />
              <button className="btn-sm" onClick={handleCatSearch} disabled={catLoading}>
                {catLoading ? '…' : 'Buscar'}
              </button>
            </div>
            {catResults.length > 0 && !selectedCat && (
              <div style={{
                border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                marginTop: 4, background: 'var(--bg-card)', maxHeight: 180, overflowY: 'auto',
              }}>
                {catResults.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedCat(c); setCatResults([]) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 12px', border: 'none', borderBottom: '1px solid var(--line)',
                      background: 'none', cursor: 'pointer', fontSize: 13,
                    }}
                  >
                    <strong>{c.domain_name || c.category_name}</strong>
                    <span style={{ color: 'var(--ink-mute)', marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      {c.category_id || c.id}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="form-hint">La categoría se sugiere automáticamente del título. Podés buscar otra.</p>
          </div>

          {/* Imagen */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">URL de imagen <span>(opcional)</span></label>
            <input
              className="form-input"
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://…"
            />
            <p className="form-hint">Debe ser una URL pública (HTTPS). Recomendado: fondo blanco, al menos 500x500px.</p>
          </div>

          {/* Descripción */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Descripción <span>(opcional)</span></label>
            <textarea
              className="form-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descripción del producto, características, garantía…"
              rows={3}
              style={{ resize: 'vertical', fontFamily: 'var(--font-sans)' }}
            />
          </div>

          {/* Error */}
          {fieldError && (
            <div style={{ padding: '8px 12px', background: 'var(--neg-bg)', border: '1px solid var(--neg)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--neg)' }}>
              ⚠️ {fieldError}
            </div>
          )}

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button className="btn-sm" onClick={onClose}>Cancelar</button>
            <button
              className="btn-sm primary"
              onClick={handlePublish}
              disabled={publishing || !title.trim() || !price || !selectedCat}
            >
              {publishing ? '⟳ Publicando…' : '🚀 Publicar en ML'}
            </button>
          </div>

          <p className="form-hint" style={{ textAlign: 'center' }}>
            La publicación aparecerá en tu cuenta ML. El ID se vinculará automáticamente al producto.
          </p>
        </div>
      </div>
    </div>
  )
}
