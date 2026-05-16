import { useState } from 'react'
import { fmt, fmtARS } from '../lib/calculations.js'

const ESCENARIOS = [10, 15, 20, 25, 30, 35]

function calcPricing({ costoARS, mlPct, adsPct, ivaPct, iibbPct, otrosPct, targetMargen, modoTarget }) {
  const factorNeto = 1 - mlPct / 100 - adsPct / 100 - ivaPct / 100 - iibbPct / 100 - otrosPct / 100
  if (factorNeto <= 0) return null

  let precio
  if (modoTarget === 'precio') {
    // target = % margen sobre precio de venta
    const denom = factorNeto - targetMargen / 100
    if (denom <= 0) return null
    precio = costoARS / denom
  } else {
    // target = % margen sobre costo
    precio = (costoARS * (1 + targetMargen / 100)) / factorNeto
  }

  const netoML = precio * (1 - mlPct / 100)
  const netoUnitario = precio * factorNeto
  const margenUnitario = netoUnitario - costoARS
  const margenSobrePrecio = margenUnitario / precio
  const margenSobreCosto = margenUnitario / costoARS

  return { precio, netoML, netoUnitario, margenUnitario, margenSobrePrecio, margenSobreCosto, factorNeto }
}

function calcEscenario({ costoARS, mlPct, adsPct, ivaPct, iibbPct, otrosPct, margenPct, modoTarget }) {
  return calcPricing({ costoARS, mlPct, adsPct, ivaPct, iibbPct, otrosPct, targetMargen: margenPct, modoTarget })
}

function roundPrice(precio) {
  // Redondea al múltiplo de 1000 más cercano hacia arriba
  return Math.ceil(precio / 1000) * 1000
}

export default function PricingPanel({ aereo, maritimo }) {
  const [modo, setModo] = useState('maritimo')
  const [mlPct, setMlPct] = useState(25)
  const [adsPct, setAdsPct] = useState(12)
  const [ivaPct, setIvaPct] = useState(21)
  const [iibbPct, setIibbPct] = useState(0)
  const [otrosPct, setOtrosPct] = useState(0)
  const [targetMargen, setTargetMargen] = useState(20)
  const [modoTarget, setModoTarget] = useState('precio')
  const [precioCustom, setPrecioCustom] = useState('')

  const base = modo === 'aereo' ? aereo : maritimo
  const costoARS = base?.costoUnitARS

  if (!costoARS) return null

  const params = { costoARS, mlPct, adsPct, ivaPct, iibbPct, otrosPct }
  const resultado = calcPricing({ ...params, targetMargen, modoTarget })

  // Si el usuario ingresó un precio manual, calcular desde ese precio
  let resultadoCustom = null
  const precioNum = parseFloat(precioCustom)
  if (precioCustom && !isNaN(precioNum) && precioNum > 0) {
    const factorNeto = 1 - mlPct / 100 - adsPct / 100 - ivaPct / 100 - iibbPct / 100 - otrosPct / 100
    const netoML = precioNum * (1 - mlPct / 100)
    const netoUnitario = precioNum * factorNeto
    const margenUnitario = netoUnitario - costoARS
    resultadoCustom = {
      precio: precioNum,
      netoML,
      netoUnitario,
      margenUnitario,
      margenSobrePrecio: margenUnitario / precioNum,
      margenSobreCosto: margenUnitario / costoARS,
    }
  }

  const displayResult = resultadoCustom || resultado

  return (
    <div className="card" style={{ marginTop: 4 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <span>Calculadora de pricing — Mercado Libre</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setModo('aereo')}
            style={{
              padding: '3px 10px', borderRadius: 6, border: '1.5px solid',
              cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: modo === 'aereo' ? 'var(--aereo-bg)' : 'var(--bg)',
              color: modo === 'aereo' ? 'var(--aereo)' : 'var(--ink-mute)',
              borderColor: modo === 'aereo' ? 'var(--aereo)' : 'var(--line)',
            }}>
            ✈ Aéreo
          </button>
          <button
            onClick={() => setModo('maritimo')}
            style={{
              padding: '3px 10px', borderRadius: 6, border: '1.5px solid',
              cursor: 'pointer', fontSize: 11, fontWeight: 700,
              background: modo === 'maritimo' ? 'var(--maritimo-bg)' : 'var(--bg)',
              color: modo === 'maritimo' ? 'var(--maritimo)' : 'var(--ink-mute)',
              borderColor: modo === 'maritimo' ? 'var(--maritimo)' : 'var(--line)',
            }}>
            🚢 Marítimo
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* Costo base */}
        <div style={{
          background: 'var(--bg-alt)', borderRadius: 8, padding: '10px 14px',
          marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Costo landed / unidad
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
              {fmtARS(costoARS)}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>FOB / unidad</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-soft)' }}>
              USD {fmt(base.fobUnitUSD, 2)}
            </div>
          </div>
        </div>

        {/* Config costos variables */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: '%ML', val: mlPct, set: setMlPct, hint: 'Comisión ML' },
            { label: '%Ads', val: adsPct, set: setAdsPct, hint: 'Publicidad' },
            { label: '%IVA', val: ivaPct, set: setIvaPct, hint: 'IVA ML (21% s/precio)' },
            { label: '%IIBB', val: iibbPct, set: setIibbPct, hint: 'Ing. Brutos' },
            { label: '%Otros', val: otrosPct, set: setOtrosPct, hint: 'Variables extra' },
          ].map(({ label, val, set, hint }) => (
            <div key={label} className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{label}</label>
              <input
                className="form-input mono"
                type="number" min="0" max="100" step="0.5"
                value={val}
                onChange={e => set(parseFloat(e.target.value) || 0)}
              />
              <p className="form-hint">{hint}</p>
            </div>
          ))}
        </div>

        <div style={{
          background: 'var(--bg-soft)', borderRadius: 6, padding: '7px 12px',
          marginBottom: 16, fontSize: 12, color: 'var(--ink-mute)'
        }}>
          Factor neto = <strong>{fmt((1 - mlPct/100 - adsPct/100 - ivaPct/100 - iibbPct/100 - otrosPct/100) * 100, 2)}%</strong> del precio queda para costo + margen.
          {' '}IVA = precio × 21% directo (metodología ML). Si usás crédito fiscal del import, podés bajar a ~14%.
        </div>

        {/* Target o precio manual */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label className="form-label">Target de margen</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                className="form-input"
                value={modoTarget}
                onChange={e => setModoTarget(e.target.value)}
                style={{ flex: '0 0 auto', width: 'auto', paddingRight: 24 }}
              >
                <option value="precio">% sobre precio</option>
                <option value="costo">% sobre costo</option>
              </select>
              <input
                className="form-input mono"
                type="number" min="0" max="99" step="1"
                value={targetMargen}
                onChange={e => setTargetMargen(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div>
            <label className="form-label">O ingresá precio directo <span>ARS</span></label>
            <input
              className="form-input mono"
              type="number" min="0" step="1000"
              placeholder="Ej: 350000"
              value={precioCustom}
              onChange={e => { setPrecioCustom(e.target.value) }}
            />
            <p className="form-hint">Si ingresás precio → calculamos el margen resultante</p>
          </div>
        </div>

        {/* Resultado principal */}
        {displayResult && (
          <>
            <div style={{
              border: `2px solid ${displayResult.margenUnitario >= 0 ? 'var(--pos)' : 'var(--neg)'}`,
              borderRadius: 10, padding: '14px 16px', marginBottom: 16,
              background: displayResult.margenUnitario >= 0 ? '#f0fdf4' : '#fef2f2',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                    Precio sugerido
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
                    {fmtARS(precioCustom ? displayResult.precio : roundPrice(displayResult.precio))}
                  </div>
                  {!precioCustom && (
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                      Redondeado a miles. Exacto: {fmtARS(displayResult.precio)}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                    Margen / unidad
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: displayResult.margenUnitario >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                    {fmtARS(displayResult.margenUnitario)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                    % sobre precio / costo
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
                    {fmt(displayResult.margenSobrePrecio * 100, 1)}% / {fmt(displayResult.margenSobreCosto * 100, 1)}%
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div className="kpi-row">
                  <span className="kpi-row-label">Neto ML (después comisión)</span>
                  <span className="kpi-row-value">{fmtARS(displayResult.netoML)}</span>
                </div>
                <div className="kpi-row">
                  <span className="kpi-row-label">Neto unitario (después de todo)</span>
                  <span className="kpi-row-value">{fmtARS(displayResult.netoUnitario)}</span>
                </div>
              </div>
            </div>

            {/* Tabla de escenarios */}
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Escenarios de rentabilidad ({modoTarget === 'precio' ? '% sobre precio' : '% sobre costo'})
            </div>
            <table className="breakdown-table">
              <thead>
                <tr>
                  <th>Margen %</th>
                  <th>Precio sugerido</th>
                  <th>Precio redondeado</th>
                  <th>Neto unitario</th>
                  <th>Margen ARS</th>
                  <th>% s/ costo</th>
                </tr>
              </thead>
              <tbody>
                {ESCENARIOS.map(pct => {
                  const r = calcEscenario({ ...params, margenPct: pct, modoTarget })
                  if (!r) return null
                  const esTarget = pct === targetMargen
                  return (
                    <tr key={pct} style={esTarget ? { background: 'var(--brand-light)' } : {}}>
                      <td style={{ fontWeight: esTarget ? 700 : 400 }}>
                        {esTarget ? '★ ' : ''}{pct}%
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', textAlign: 'right' }}>
                        {fmtARS(r.precio)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand)', textAlign: 'right', fontWeight: 600 }}>
                        {fmtARS(roundPrice(r.precio))}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                        {fmtARS(r.netoUnitario)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: r.margenUnitario >= 0 ? 'var(--pos)' : 'var(--neg)', fontWeight: 600 }}>
                        {fmtARS(r.margenUnitario)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                        {fmt(r.margenSobreCosto * 100, 1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
