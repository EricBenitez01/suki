import { useState } from 'react'
import { DEFAULTS } from '../lib/calculations.js'

export default function InputPanel({ values, onChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const set = (key) => (e) => {
    const raw = e.target.value
    const num = parseFloat(raw)
    onChange({ ...values, [key]: isNaN(num) ? '' : num })
  }

  const setStr = (key) => (e) => onChange({ ...values, [key]: e.target.value })

  return (
    <div className="card">
      <div className="card-header">Datos del producto</div>
      <div className="card-body">

        <div className="form-group">
          <label className="form-label">Producto</label>
          <input className="form-input" type="text"
            placeholder="Ej: Tablet Edna 10"
            value={values.producto} onChange={setStr('producto')} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Unidades</label>
            <input className="form-input mono" type="number" min="1" step="1"
              placeholder="0" value={values.unidades} onChange={set('unidades')} />
          </div>
          <div className="form-group">
            <label className="form-label">FOB por unidad <span>USD</span></label>
            <input className="form-input mono" type="number" min="0" step="0.01"
              placeholder="0.00" value={values.fobUnit === '' ? '' : Number(values.fobUnit).toFixed ? values.fobUnit : ''} onChange={set('fobUnit')} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">FOB total <span>USD</span></label>
          <input className="form-input mono" type="number" min="0" step="0.01"
            placeholder="0.00" value={values.fob} onChange={set('fob')} />
          <p className="form-hint">Podés ingresar FOB unitario arriba o FOB total acá — se sincronizan automáticamente</p>
        </div>

        <div className="form-section">Carga</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Peso bruto <span>kg</span></label>
            <input className="form-input mono" type="number" min="0" step="0.1"
              placeholder="0.0" value={values.pesoKg} onChange={set('pesoKg')} />
          </div>
          <div className="form-group">
            <label className="form-label">Bultos</label>
            <input className="form-input mono" type="number" min="1" step="1"
              placeholder="1" value={values.bultos} onChange={set('bultos')} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Dimensiones por bulto <span>cm</span></label>
          <div className="form-row-3">
            <input className="form-input mono" type="number" min="0" step="0.1"
              placeholder="Largo" value={values.largoCm} onChange={set('largoCm')} />
            <input className="form-input mono" type="number" min="0" step="0.1"
              placeholder="Ancho" value={values.anchoCm} onChange={set('anchoCm')} />
            <input className="form-input mono" type="number" min="0" step="0.1"
              placeholder="Alto" value={values.altoCm} onChange={set('altoCm')} />
          </div>
          <p className="form-hint">Courier: divisor /5000 · Marítimo: W/M (ton o m³, el mayor)</p>
        </div>

        <div className="form-section">Arancel</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Posición NCM</label>
            <input className="form-input" type="text"
              placeholder="Ej: 8471.30.12" value={values.ncm} onChange={setStr('ncm')} />
          </div>
          <div className="form-group">
            <label className="form-label">DI <span>%</span></label>
            <input className="form-input mono" type="number" min="0" max="100" step="0.5"
              placeholder="0" value={values.di} onChange={set('di')} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Tipo de cambio <span>ARS / USD</span></label>
          <input className="form-input mono" type="number" min="0" step="0.01"
            placeholder={DEFAULTS.tc} value={values.tc} onChange={set('tc')} />
        </div>

        {/* Advanced */}
        <button
          className={`advanced-toggle ${showAdvanced ? 'open' : ''}`}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
          Configuración avanzada
        </button>

        {showAdvanced && (
          <div className="advanced-panel">

            <div className="form-section">Impuestos aduaneros <span style={{fontWeight:400,textTransform:'none',letterSpacing:0}}>(según PA)</span></div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">IVA <span>%</span></label>
                <input className="form-input mono" type="number" min="0" step="0.5"
                  value={values.ivaPct} onChange={set('ivaPct')} />
              </div>
              <div className="form-group">
                <label className="form-label">IVA Adicional <span>%</span></label>
                <input className="form-input mono" type="number" min="0" step="0.5"
                  value={values.ivaAdicionalPct} onChange={set('ivaAdicionalPct')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Ganancias <span>%</span></label>
                <input className="form-input mono" type="number" min="0" step="0.5"
                  value={values.gananciasPct} onChange={set('gananciasPct')} />
              </div>
              <div className="form-group">
                <label className="form-label">IIBB <span>%</span></label>
                <input className="form-input mono" type="number" min="0" step="0.5"
                  value={values.iibbPct} onChange={set('iibbPct')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">T. Estadística <span>%</span></label>
                <input className="form-input mono" type="number" min="0" step="0.5"
                  value={values.tasaEstadisticaPct} onChange={set('tasaEstadisticaPct')} />
              </div>
              <div className="form-group">
                <label className="form-label">TC ARS/USD</label>
                <input className="form-input mono" type="number" min="0" step="1"
                  value={values.tc} onChange={set('tc')} />
              </div>
            </div>

            <div className="form-section" style={{color:'var(--aereo)'}}>✈ Aéreo (courier)</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Flete <span>USD/kg·vol</span></label>
                <input className="form-input mono" type="number" min="0" step="0.5"
                  value={values.fleteAereoKgUSD} onChange={set('fleteAereoKgUSD')} />
              </div>
              <div className="form-group">
                <label className="form-label">Seguro <span>%</span></label>
                <input className="form-input mono" type="number" min="0" step="0.1"
                  value={values.seguroPctAereo} onChange={set('seguroPctAereo')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Handling <span>USD</span></label>
                <input className="form-input mono" type="number" min="0" step="10"
                  value={values.handlingAereo} onChange={set('handlingAereo')} />
              </div>
              <div className="form-group">
                <label className="form-label">Almacenaje <span>días</span></label>
                <input className="form-input mono" type="number" min="1" step="1"
                  value={values.almacenajeDias} onChange={set('almacenajeDias')} />
              </div>
            </div>
            <p className="form-hint" style={{marginBottom:10}}>
              Almacenaje: USD {values.almacenajeKgDia}/kg·día × peso facturable × días
            </p>

            <div className="form-section" style={{color:'var(--maritimo)'}}>🚢 Marítimo (LCL)</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Flete <span>USD/W·M</span></label>
                <input className="form-input mono" type="number" min="0" step="10"
                  value={values.fleteMarItimoWMRate} onChange={set('fleteMarItimoWMRate')} />
              </div>
              <div className="form-group">
                <label className="form-label">Seguro <span>%</span></label>
                <input className="form-input mono" type="number" min="0" step="0.05"
                  value={values.seguroPctMaritimo} onChange={set('seguroPctMaritimo')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Depósito fiscal <span>USD</span></label>
                <input className="form-input mono" type="number" min="0" step="50"
                  value={values.depositoFiscal} onChange={set('depositoFiscal')} />
              </div>
              <div className="form-group">
                <label className="form-label">Handling agencia <span>USD</span></label>
                <input className="form-input mono" type="number" min="0" step="10"
                  value={values.handlingMaritimo} onChange={set('handlingMaritimo')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Recargo IMO flete <span>USD</span></label>
                <input className="form-input mono" type="number" min="0" step="10"
                  value={values.recargIMOFlete} onChange={set('recargIMOFlete')} />
              </div>
              <div className="form-group">
                <label className="form-label">Recargo IMO depósito <span>USD</span></label>
                <input className="form-input mono" type="number" min="0" step="10"
                  value={values.recargIMODeposito} onChange={set('recargIMODeposito')} />
              </div>
            </div>
            <p className="form-hint" style={{marginBottom:10}}>
              Desconsolidación: USD 25 × W/M (mín USD 50, máx USD 350) — calculado automáticamente
            </p>

            <div className="form-section">Despacho (ambos)</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Despachante <span>%CIF</span></label>
                <input className="form-input mono" type="number" min="0" step="0.1"
                  value={values.despachantePct} onChange={set('despachantePct')} />
              </div>
              <div className="form-group">
                <label className="form-label">Despachante mín <span>USD</span></label>
                <input className="form-input mono" type="number" min="0" step="50"
                  value={values.despachanteMín} onChange={set('despachanteMín')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Gs. operativos <span>USD</span></label>
                <input className="form-input mono" type="number" min="0" step="10"
                  value={values.gastosOperativos} onChange={set('gastosOperativos')} />
              </div>
              <div className="form-group">
                <label className="form-label">Digitaliz. + SIM <span>USD</span></label>
                <input className="form-input mono" type="number" min="0" step="5"
                  value={values.digitalizacion} onChange={set('digitalizacion')} />
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
