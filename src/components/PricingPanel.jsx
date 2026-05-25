import { useState } from 'react'
import { fmt, fmtARS, calcPricing } from '../lib/calculations.js'

const ESCENARIOS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 100, 120, 150]

function BreakevenSection({ costoUnitARS, totalARS, mlPct, adsPct, ivaPct, iibbPct, otrosPct, modoTarget }) {
  const factorNeto = 1 - mlPct / 100 - adsPct / 100 - ivaPct / 100 - iibbPct / 100 - otrosPct / 100
  if (factorNeto <= 0 || !totalARS) return null

  const unidadesTotales = Math.round(totalARS / costoUnitARS)

  const rows = ESCENARIOS.map(pct => {
    let precio
    if (modoTarget === 'precio') {
      const denom = factorNeto - pct / 100
      if (denom <= 0) return null
      precio = costoUnitARS / denom
    } else {
      precio = (costoUnitARS * (1 + pct / 100)) / factorNeto
    }
    const revenueUnit = precio * factorNeto
    const beUnits = Math.ceil(totalARS / revenueUnit)
    const bePct = (beUnits / unidadesTotales) * 100
    return { pct, precio, beUnits, bePct }
  }).filter(Boolean)

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
        Punto de equilibrio — recuperar inversión
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 10 }}>
        Inversión total del lote: <strong style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{fmtARS(totalARS)}</strong>
        {' '}· {unidadesTotales} unidades.
        {' '}Unidades a vender para recuperar toda la inversión según escenario de precio:
      </div>
      <table className="breakdown-table">
        <thead>
          <tr>
            <th>Margen %</th>
            <th>Precio redondeado</th>
            <th>Unidades a vender</th>
            <th>% del lote</th>
            <th>Restan con ganancia</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ pct, precio, beUnits, bePct }) => {
            const restantes = unidadesTotales - beUnits
            const cls = bePct <= 60 ? 'breakeven-row-ok' : bePct <= 85 ? 'breakeven-row-warn' : 'breakeven-row-bad'
            return (
              <tr key={pct} className={cls}>
                <td>{pct}%</td>
                <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600 }}>
                  {fmtARS(Math.ceil(precio / 1000) * 1000)}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                  {beUnits > unidadesTotales ? `> ${unidadesTotales} ✗` : beUnits}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                  {bePct > 100 ? '> 100%' : fmt(bePct, 1) + '%'}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                  {restantes < 0 ? '—' : `${restantes} uds`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 6 }}>
        🟢 &lt;60% · 🟡 60–85% · 🔴 &gt;85% del lote necesario para recuperar la inversión.
      </p>
    </div>
  )
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
  const [ivaPct, setIvaPct] = useState(14)
  const [iibbPct, setIibbPct] = useState(0)
  const [otrosPct, setOtrosPct] = useState(0)
  const [targetMargen, setTargetMargen] = useState(20)
  const [modoTarget, setModoTarget] = useState('precio')
  const [precioCustom, setPrecioCustom] = useState('')
  const [costoRapido, setCostoRapido] = useState('')
  const [overrideIndep, setOverrideIndep] = useState(false)

  const hasImported = !!(aereo && maritimo)
  const modoRapido = !hasImported || overrideIndep

  const base = modo === 'aereo' ? aereo : maritimo
  const costoARS = modoRapido
    ? (parseFloat(costoRapido) || null)
    : base?.costoUnitARS

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
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span>Calculadora de pricing — Mercado Libre</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {hasImported && (
            <button
              onClick={() => { setOverrideIndep(v => !v); setCostoRapido('') }}
              style={{
                padding: '3px 10px', borderRadius: 6, border: '1.5px solid var(--line)',
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: overrideIndep ? 'var(--brand-light)' : 'var(--bg)',
                color: overrideIndep ? 'var(--brand)' : 'var(--ink-mute)',
                borderColor: overrideIndep ? 'var(--brand-mid)' : 'var(--line)',
              }}>
              {overrideIndep ? '↩ Usar costo del cotizador' : '✏ Ingresar costo propio'}
            </button>
          )}
          {!modoRapido && (
            <>
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
            </>
          )}
        </div>
      </div>

      <div className="card-body">
        {/* Pricing rápido: sin cálculo completo */}
        {modoRapido && (
          <div style={{
            background: 'var(--brand-light)', border: '1.5px solid var(--brand-mid)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', marginBottom: 8 }}>
              💡 Pricing rápido — ingresá el costo landed estimado
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label">Costo landed / unidad <span>ARS</span></label>
                <input
                  className="form-input mono"
                  type="number" min="0" step="1000"
                  placeholder="Ej: 140000"
                  value={costoRapido}
                  onChange={e => setCostoRapido(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <p className="form-hint" style={{ marginTop: 6 }}>
              {hasImported && overrideIndep
                ? 'Ingresá cualquier costo para simular — o usá el botón de arriba para volver al costo calculado.'
                : 'Completá el cotizador de flete para calcular el costo exacto con impuestos y flete.'}
            </p>
          </div>
        )}

        {/* Costo base (cuando viene del cálculo completo) */}
        {!modoRapido && costoARS && (
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
        )}

        {/* Config costos variables */}
        <div className="pct-inputs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
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
        <div className="pricing-target-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
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
        {costoARS && displayResult && (
          <>
            <div style={{
              border: `2px solid ${displayResult.margenUnitario >= 0 ? 'var(--pos)' : 'var(--neg)'}`,
              borderRadius: 10, padding: '14px 16px', marginBottom: 16,
              background: displayResult.margenUnitario >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)',
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
            <div style={{ overflowX: 'auto' }}>
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
                    <tr
                      key={pct}
                      style={{ cursor: 'pointer', background: esTarget ? 'var(--brand-light)' : undefined }}
                      title="Click para usar este escenario"
                      onClick={() => { setTargetMargen(pct); setPrecioCustom('') }}
                    >
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
            </div>

            {/* ── Punto de equilibrio ── */}
            <BreakevenSection
              costoUnitARS={costoARS}
              totalARS={base?.totalARS}
              mlPct={mlPct} adsPct={adsPct} ivaPct={ivaPct}
              iibbPct={iibbPct} otrosPct={otrosPct}
              modoTarget={modoTarget}
            />
          </>
        )}
      </div>
    </div>
  )
}
