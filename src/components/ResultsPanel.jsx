import { useState } from 'react'
import { fmtUSD, fmtARS, fmt, calcSensitivity } from '../lib/calculations.js'

function CostBar({ mode, fob, flete, impuestos, gastos, total }) {
  const pctFob = (fob / total * 100).toFixed(1)
  const pctFlete = (flete / total * 100).toFixed(1)
  const pctImp = (impuestos / total * 100).toFixed(1)
  const pctGastos = (gastos / total * 100).toFixed(1)
  return (
    <div className="cost-bar-wrap">
      <div className="cost-bar-label">
        <span>Composición del costo</span>
        <span>FOB {pctFob}% · Flete {pctFlete}% · Imp {pctImp}% · Op {pctGastos}%</span>
      </div>
      <div className="cost-bar-track">
        <div className={`cost-bar-fill ${mode}`} style={{ width: `${100 - parseFloat(pctFob)}%` }} />
      </div>
    </div>
  )
}

function ModeCard({ mode, data, label, icon }) {
  const flete = mode === 'aereo' ? data.fleteAereo : data.fleteMaritimo
  return (
    <div className={`mode-card ${mode}`}>
      <div className="mode-card-header">
        <span className="mode-icon">{icon}</span>
        <span className="mode-title">{label}</span>
        <span className="mode-badge">{data.tiempo}</span>
      </div>
      <div className="mode-card-body">
        <div className="kpi-main">
          <div className="kpi-label">Costo total landed</div>
          <div className="kpi-value">{fmtUSD(data.totalUSD)}</div>
          <div className="kpi-sub">{fmtARS(data.totalARS)}</div>
        </div>
        <div className="kpi-row">
          <span className="kpi-row-label">Por unidad USD</span>
          <span className="kpi-row-value">{fmtUSD(data.costoUnitUSD)}</span>
        </div>
        <div className="kpi-row">
          <span className="kpi-row-label">Por unidad ARS</span>
          <span className="kpi-row-value">{fmtARS(data.costoUnitARS)}</span>
        </div>
        <div className="kpi-row">
          <span className="kpi-row-label">FOB / unidad</span>
          <span className="kpi-row-value">{fmtUSD(data.fobUnitUSD)}</span>
        </div>
        <div className="kpi-row">
          <span className="kpi-row-label">Flete</span>
          <span className="kpi-row-value">{fmtUSD(flete)}</span>
        </div>
        <div className="kpi-row">
          <span className="kpi-row-label">Impuestos aduaneros</span>
          <span className="kpi-row-value">{fmtUSD(data.totalImpuestos)}</span>
        </div>
        <div className="kpi-row">
          <span className="kpi-row-label">Gastos operativos</span>
          <span className="kpi-row-value">{fmtUSD(data.gastosTotal)}</span>
        </div>
        <CostBar
          mode={mode}
          fob={data.fob}
          flete={flete}
          impuestos={data.totalImpuestos}
          gastos={data.gastosTotal}
          total={data.totalUSD}
        />
      </div>
    </div>
  )
}

function SavingsBanner({ aereo, maritimo }) {
  const diff = Math.abs(aereo.totalUSD - maritimo.totalUSD)
  const cheaper = maritimo.totalUSD < aereo.totalUSD ? 'maritimo' : 'aereo'
  const diffPct = (diff / Math.min(aereo.totalUSD, maritimo.totalUSD) * 100).toFixed(1)
  if (cheaper === 'maritimo') {
    return (
      <div className="savings-banner maritimo-wins">
        🚢 <span>El marítimo ahorra <strong>{fmtUSD(diff)}</strong> ({diffPct}% menos). El aéreo tarda ~15–20 días menos, pero cuesta <strong>{fmtUSD(diff)}</strong> más.</span>
      </div>
    )
  }
  return (
    <div className="savings-banner aereo-wins">
      ✈️ <span>El aéreo conviene: es <strong>{fmtUSD(diff)}</strong> más barato ({diffPct}% menos) y llega antes. Revisá los gastos fijos del marítimo.</span>
    </div>
  )
}

function Row({ label, aereo, maritimo, bold, total, sectionHead, indent }) {
  if (sectionHead) {
    return (
      <tr className="section-head">
        <td colSpan={3}>{label}</td>
      </tr>
    )
  }
  return (
    <tr className={total ? 'total' : bold ? 'subtotal' : ''}>
      <td style={indent ? { paddingLeft: 24 } : {}}>{label}</td>
      <td className="aereo-col">{aereo}</td>
      <td className="maritimo-col">{maritimo}</td>
    </tr>
  )
}

function BreakdownTable({ aereo, maritimo, producto }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">Desglose completo — {producto || 'Producto'}</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="breakdown-table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th style={{ color: 'var(--aereo)' }}>✈ Aéreo (USD)</th>
              <th style={{ color: 'var(--maritimo)' }}>🚢 Marítimo (USD)</th>
            </tr>
          </thead>
          <tbody>
            <Row sectionHead label="Base" />
            <Row label="FOB" aereo={fmtUSD(aereo.fob)} maritimo={fmtUSD(maritimo.fob)} />
            <Row
              label={`Flete (${fmt(aereo.pesoFacturable,2)} kg·vol /5000 · W/M ${fmt(maritimo.wm,3)})`}
              aereo={fmtUSD(aereo.fleteAereo)}
              maritimo={fmtUSD(maritimo.fleteMaritimo)}
            />
            <Row label="Recargo IMO" aereo="—" maritimo={fmtUSD(maritimo.recargIMOFlete)} />
            <Row label="Seguro internacional" aereo={fmtUSD(aereo.seguro)} maritimo={fmtUSD(maritimo.seguro)} />
            <Row label="CIF" aereo={fmtUSD(aereo.cif)} maritimo={fmtUSD(maritimo.cif)} bold />

            <Row sectionHead label="Impuestos aduaneros (sobre CIF)" />
            <Row label={`DI (${fmt(aereo.diAmt / aereo.cif * 100, 1)}%)`}
              aereo={fmtUSD(aereo.diAmt)} maritimo={fmtUSD(maritimo.diAmt)} />
            <Row label="Tasa estadística"
              aereo={fmtUSD(aereo.teAmt)} maritimo={fmtUSD(maritimo.teAmt)} />
            <Row label="Base imponible" aereo={fmtUSD(aereo.baseImponible)} maritimo={fmtUSD(maritimo.baseImponible)} bold />
            <Row label={`IVA (${fmt(aereo.ivaAmt / aereo.baseImponible * 100, 1)}%)`}
              aereo={fmtUSD(aereo.ivaAmt)} maritimo={fmtUSD(maritimo.ivaAmt)} indent />
            <Row label={`IVA Adicional (${fmt(aereo.ivaAddAmt / aereo.baseImponible * 100, 1)}%)`}
              aereo={fmtUSD(aereo.ivaAddAmt)} maritimo={fmtUSD(maritimo.ivaAddAmt)} indent />
            <Row label={`Ganancias (${fmt(aereo.ganAmt / aereo.baseImponible * 100, 1)}%)`}
              aereo={fmtUSD(aereo.ganAmt)} maritimo={fmtUSD(maritimo.ganAmt)} indent />
            <Row label={`IIBB (${fmt(aereo.iibbAmt / aereo.baseImponible * 100, 1)}%)`}
              aereo={fmtUSD(aereo.iibbAmt)} maritimo={fmtUSD(maritimo.iibbAmt)} indent />

            <Row sectionHead label="Gastos operativos" />
            <Row label="Gestión aduanera courier (DHL/FedEx incluido en DAP)"
              aereo={fmtUSD(aereo.handlingAereo)} maritimo="—" />
            <Row label="Honorarios despachante (1.5% CIF, mín USD 400)"
              aereo="—" maritimo={fmtUSD(maritimo.despachante)} />
            <Row label="Gastos operativos + digitalización + SIM"
              aereo="—" maritimo={fmtUSD(maritimo.gastosOperativos + maritimo.digitalizacion + maritimo.sim)} />
            <Row label="Handling agencia marítima"
              aereo="—" maritimo={fmtUSD(maritimo.handlingMaritimo)} />
            <Row label="Desconsolidación (USD 25×W/M, mín 50, máx 350)"
              aereo="—" maritimo={fmtUSD(maritimo.desconsolidacion)} />
            <Row label="Depósito fiscal (estimado)"
              aereo="—" maritimo={fmtUSD(maritimo.depositoFiscal)} />
            <Row label="Recargo IMO depósito"
              aereo="—" maritimo={fmtUSD(maritimo.recargIMODeposito)} />

            <Row label="TOTAL LANDED (USD)" aereo={fmtUSD(aereo.totalUSD)} maritimo={fmtUSD(maritimo.totalUSD)} total />
            <Row label="TOTAL LANDED (ARS)" aereo={fmtARS(aereo.totalARS)} maritimo={fmtARS(maritimo.totalARS)} total />
            <Row label="Costo landed / unidad USD" aereo={fmtUSD(aereo.costoUnitUSD)} maritimo={fmtUSD(maritimo.costoUnitUSD)} total />
            <Row label="Costo landed / unidad ARS" aereo={fmtARS(aereo.costoUnitARS)} maritimo={fmtARS(maritimo.costoUnitARS)} total />
          </tbody>
        </table>
      </div>
      {(aereo.cbm > 0 || aereo.pesoVol > 0) && (
        <div className="card-body" style={{ paddingTop: 8, paddingBottom: 10 }}>
          <p className="text-mute" style={{ fontSize: 12 }}>
            Volumen: {fmt(aereo.cbm, 4)} m³ ·
            Peso vol. courier (/5000): {fmt(aereo.pesoVol, 2)} kg ·
            Peso facturable courier: {fmt(aereo.pesoFacturable, 2)} kg ·
            W/M marítimo: {fmt(maritimo.wm, 4)}
          </p>
        </div>
      )}
    </div>
  )
}

function SensitivityTable({ inputs, currentAereoUnit, currentMaritimoUnit }) {
  const rows = calcSensitivity(inputs)
  if (rows.length < 2) return null

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>📈 Tabla de sensibilidad — Costo/unidad según volumen</span>
      </div>
      <div className="card-body" style={{ padding: '12px 0 4px' }}>
        <p style={{ fontSize: 12, color: 'var(--ink-mute)', padding: '0 16px', marginBottom: 10 }}>
          Escala FOB, peso y unidades proporcionalmente. Muestra cómo el costo unitario varía al importar más o menos cantidad.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Escala</th>
                <th>Unidades</th>
                <th>FOB total</th>
                <th style={{ color: 'var(--aereo)' }}>✈ Aéreo / ud</th>
                <th style={{ color: 'var(--maritimo)' }}>🚢 Marítimo / ud</th>
                <th>Diferencia / ud</th>
                <th>Ganador</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ multiplier, unidades, fobTotal, aereo, maritimo }) => {
                const diff = maritimo.costoUnitUSD - aereo.costoUnitUSD
                const isCurrent = multiplier === 1
                const maritimoWins = diff < 0
                return (
                  <tr key={multiplier} style={{ background: isCurrent ? 'var(--brand-light)' : undefined, fontWeight: isCurrent ? 700 : 400 }}>
                    <td style={{ fontWeight: 700, color: isCurrent ? 'var(--brand)' : 'var(--ink-mute)' }}>
                      {isCurrent ? '★ ' : ''}{multiplier}x
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmt(unidades, 0)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{fmtUSD(fobTotal)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--aereo)' }}>{fmtUSD(aereo.costoUnitUSD)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--maritimo)' }}>{fmtUSD(maritimo.costoUnitUSD)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600, color: maritimoWins ? 'var(--maritimo)' : 'var(--aereo)' }}>
                      {maritimoWins ? `🚢 ${fmtUSD(Math.abs(diff))} menos` : `✈ ${fmtUSD(Math.abs(diff))} menos`}
                    </td>
                    <td style={{ fontWeight: 600, color: maritimoWins ? 'var(--maritimo)' : 'var(--aereo)' }}>
                      {maritimoWins ? '🚢 Mar.' : '✈ Aéreo'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: 'var(--ink-mute)', padding: '8px 16px 0' }}>
          ★ = escenario actual. El marítimo conviene más a mayor volumen por dilución de gastos fijos (~USD 2.000 fijos vs USD 60 aéreo).
        </p>
      </div>
    </div>
  )
}

export default function ResultsPanel({ results, inputs, producto, onSave, savedFlash }) {
  const [showBreakdown, setShowBreakdown] = useState(false)

  if (!results) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon">⚖️</div>
            <div className="empty-state-title">Completá los datos del producto</div>
            <div className="empty-state-text">
              Ingresá los campos marcados con <strong>*</strong> para ver la comparativa de flete.
            </div>
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', maxWidth: 280, margin: '20px auto 0' }}>
              {[
                { icon: '✈', text: 'Costo landed aéreo (DHL/FedEx DAP)' },
                { icon: '🚢', text: 'Costo landed marítimo LCL' },
                { icon: '📊', text: 'Desglose completo de impuestos' },
                { icon: '💰', text: 'El resultado alimenta el módulo Pricing' },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-soft)' }}>
                  <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { aereo, maritimo } = results

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn-sm primary" onClick={onSave}>
          {savedFlash ? '✓ Simulación guardada' : '💾 Guardar simulación…'}
        </button>
      </div>

      <SavingsBanner aereo={aereo} maritimo={maritimo} />

      <div className="comparison-grid" style={{ marginTop: 16 }}>
        <ModeCard mode="aereo" data={aereo} label="Aéreo · Courier" icon="✈️" />
        <ModeCard mode="maritimo" data={maritimo} label="Marítimo · LCL" icon="🚢" />
      </div>

      <button
        className={`breakdown-toggle ${showBreakdown ? 'open' : ''}`}
        style={{ marginTop: 16 }}
        onClick={() => setShowBreakdown(v => !v)}
      >
        {showBreakdown ? 'Ocultar desglose completo' : 'Ver desglose completo de impuestos y gastos'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {showBreakdown && <BreakdownTable aereo={aereo} maritimo={maritimo} producto={producto} />}

      {inputs && <SensitivityTable inputs={inputs} currentAereoUnit={aereo.costoUnitUSD} currentMaritimoUnit={maritimo.costoUnitUSD} />}
    </div>
  )
}
