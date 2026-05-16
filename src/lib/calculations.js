/**
 * Motor de cálculo: Comparativa flete aéreo (courier) vs marítimo (LCL FOB China)
 * Basado en cotizaciones reales de Global Trip Logistics (dic 2025)
 */

export const DEFAULTS = {
  tc: 1399.23,

  // Seguro
  seguroPctAereo: 0,       // courier generalmente no incluye seguro o es opcional
  seguroPctMaritimo: 0.55, // 0.55% del valor a asegurar, min USD 100

  // Impuestos aduaneros (varían por posición arancelaria - PA)
  ivaPct: 10.5,            // 10.5% según PA (electrónica) / base IVA
  ivaAdicionalPct: 10,     // 10% según PA / base IVA
  gananciasPct: 6,         // 6% / base IVA
  iibbPct: 2.5,            // 2.5% / base IVA
  tasaEstadisticaPct: 0,   // 0% o 3% según PA

  // Flete
  fleteAereoKgUSD: 23,     // USD 23/kg·vol — courier China→Buenos Aires
  fleteMarItimoWMRate: 200, // USD 200 x W/M (ton o m3, el mayor) — LCL China→BUE

  // Gastos despacho (ambos modos)
  despachantePct: 1.5,     // 1.5% sobre CIF, mínimo USD 400
  despachanteMín: 400,
  gastosOperativos: 160,   // gastos operativos despachante
  digitalizacion: 40,
  sim: 10,                 // Impuesto Sistema María

  // Específicos AÉREO (courier)
  handlingAereo: 60,       // USD 60 + IVA
  almacenajeKgDia: 0.80,   // USD 0.80 x kg x día
  almacenajeDias: 4,       // días estimados en depósito

  // Específicos MARÍTIMO LCL
  depositoFiscal: 800,     // estimado dentro del forzoso
  recargIMOFlete: 150,     // recargo IMO sobre flete
  recargIMODeposito: 400,  // recargo IMO sobre depósito fiscal
  handlingMaritimo: 150,   // handling agencia marítima + IVA
  // desconsolidación: USD 25 x ton/m3 (min 50, max 350) — calculado automáticamente

  // Tiempos
  tiempoAereo: '25 – 35 días',    // courier China→BUE
  tiempoMaritimo: '40 – 55 días', // LCL China→BUE
}

/** Peso volumétrico courier China: largo×ancho×alto (cm) / 5000 × bultos */
export function pesoVolCourier({ largoCm, anchoCm, altoCm, bultos }) {
  if (!largoCm || !anchoCm || !altoCm || !bultos) return 0
  return (largoCm * anchoCm * altoCm * bultos) / 5000
}

/** Peso facturable courier = max(peso real, peso volumétrico /5000) */
export function pesoFacturableAereo({ pesoKg, largoCm, anchoCm, altoCm, bultos }) {
  const vol = pesoVolCourier({ largoCm, anchoCm, altoCm, bultos })
  return Math.max(pesoKg, vol)
}

/** CBM total del embarque (m³) */
export function calcCBM({ largoCm, anchoCm, altoCm, bultos }) {
  if (!largoCm || !anchoCm || !altoCm || !bultos) return 0
  return (largoCm * anchoCm * altoCm * bultos) / 1_000_000
}

/**
 * W/M marítimo: mayor entre toneladas y m³.
 * Flete = max(toneladas, cbm) × rate, mínimo USD 200.
 */
function calcFleteMaritimo({ pesoKg, cbm, fleteMarItimoWMRate }) {
  const toneladas = pesoKg / 1000
  const wm = Math.max(toneladas, cbm || 0)
  const wm_aplicado = wm > 0 ? wm : toneladas
  return Math.max(wm_aplicado * fleteMarItimoWMRate, 200)
}

/** Desconsolidación: USD 25 × W/M (min USD 50, max USD 350) */
function calcDesconsolidacion({ pesoKg, cbm }) {
  const toneladas = pesoKg / 1000
  const wm = Math.max(toneladas, cbm || 0)
  return Math.min(Math.max(wm * 25, 50), 350)
}

/** Impuestos aduaneros sobre CIF */
function aplicarImpuestos(cif, { di, tasaEstadisticaPct, ivaPct, ivaAdicionalPct, gananciasPct, iibbPct }) {
  const diAmt = cif * (di / 100)
  const teAmt = cif * (tasaEstadisticaPct / 100)
  const baseImponible = cif + diAmt + teAmt
  const ivaAmt = baseImponible * (ivaPct / 100)
  const ivaAddAmt = baseImponible * (ivaAdicionalPct / 100)
  const ganAmt = baseImponible * (gananciasPct / 100)
  const iibbAmt = baseImponible * (iibbPct / 100)
  const totalImpuestos = diAmt + teAmt + ivaAmt + ivaAddAmt + ganAmt + iibbAmt
  return { diAmt, teAmt, baseImponible, ivaAmt, ivaAddAmt, ganAmt, iibbAmt, totalImpuestos }
}

export function calcularComparativa(inputs) {
  const {
    fob, unidades, pesoKg,
    largoCm, anchoCm, altoCm, bultos,
    di, tc,
    seguroPctAereo, seguroPctMaritimo,
    tasaEstadisticaPct, ivaPct, ivaAdicionalPct, gananciasPct, iibbPct,
    despachantePct, despachanteMín, gastosOperativos, digitalizacion, sim,
    handlingAereo, almacenajeKgDia, almacenajeDias,
    depositoFiscal, recargIMOFlete, recargIMODeposito, handlingMaritimo,
    fleteAereoKgUSD, fleteMarItimoWMRate,
  } = inputs

  if (!fob || !unidades || !pesoKg || di === '' || di === undefined) return null

  const taxParams = { di, tasaEstadisticaPct, ivaPct, ivaAdicionalPct, gananciasPct, iibbPct }
  const cbm = calcCBM({ largoCm, anchoCm, altoCm, bultos })

  // ── AÉREO (courier) ──────────────────────────────────────────
  const pFactAereo = pesoFacturableAereo({ pesoKg, largoCm, anchoCm, altoCm, bultos })
  const fleteAereo = pFactAereo * fleteAereoKgUSD
  const seguroAereo = fob * (seguroPctAereo / 100)
  const cifAereo = fob + fleteAereo + seguroAereo
  const taxesAereo = aplicarImpuestos(cifAereo, taxParams)

  // Despachante courier (1.5% CIF, mín USD 400)
  const despachanteCourier = Math.max(cifAereo * (despachantePct / 100), despachanteMín)
  const almacenaje = almacenajeKgDia * Math.ceil(pFactAereo) * almacenajeDias

  const gastosAereoTotal = despachanteCourier + gastosOperativos + digitalizacion + sim + handlingAereo + almacenaje

  const totalAereo = cifAereo + taxesAereo.totalImpuestos + gastosAereoTotal

  // ── MARÍTIMO (LCL) ──────────────────────────────────────────
  const fleteMaritimo = calcFleteMaritimo({ pesoKg, cbm, fleteMarItimoWMRate })
  const seguroMaritimo = Math.max(fob * (seguroPctMaritimo / 100), 100)
  const cifMaritimo = fob + fleteMaritimo + recargIMOFlete + seguroMaritimo
  const taxesMaritimo = aplicarImpuestos(cifMaritimo, taxParams)

  // Despachante marítimo (1.5% CIF, mín USD 400)
  const despachanteMaritimo = Math.max(cifMaritimo * (despachantePct / 100), despachanteMín)
  const desconsolidacion = calcDesconsolidacion({ pesoKg, cbm })

  const gastosMarItimoTotal =
    despachanteMaritimo + gastosOperativos + digitalizacion + sim +
    handlingMaritimo + desconsolidacion + depositoFiscal + recargIMODeposito

  const totalMaritimo = cifMaritimo + taxesMaritimo.totalImpuestos + gastosMarItimoTotal

  return {
    aereo: {
      ...taxesAereo,
      fob, fleteAereo, seguro: seguroAereo, cif: cifAereo,
      pesoFacturable: pFactAereo, pesoVol: pesoVolCourier({ largoCm, anchoCm, altoCm, bultos }),
      cbm,
      despachante: despachanteCourier, gastosOperativos, digitalizacion, sim,
      handlingAereo, almacenaje, almacenajeDias, almacenajeKgDia,
      gastosTotal: gastosAereoTotal,
      totalUSD: totalAereo,
      totalARS: totalAereo * tc,
      costoUnitUSD: totalAereo / unidades,
      costoUnitARS: (totalAereo * tc) / unidades,
      fobUnitUSD: fob / unidades,
      tiempo: DEFAULTS.tiempoAereo,
    },
    maritimo: {
      ...taxesMaritimo,
      fob, fleteMaritimo, recargIMOFlete, seguro: seguroMaritimo, cif: cifMaritimo,
      pesoKg, cbm,
      wm: Math.max(pesoKg / 1000, cbm || 0),
      despachante: despachanteMaritimo, gastosOperativos, digitalizacion, sim,
      handlingMaritimo, desconsolidacion, depositoFiscal, recargIMODeposito,
      gastosTotal: gastosMarItimoTotal,
      totalUSD: totalMaritimo,
      totalARS: totalMaritimo * tc,
      costoUnitUSD: totalMaritimo / unidades,
      costoUnitARS: (totalMaritimo * tc) / unidades,
      fobUnitUSD: fob / unidades,
      tiempo: DEFAULTS.tiempoMaritimo,
    },
  }
}

export function fmt(n, decimals = 0) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtUSD(n) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return 'USD ' + fmt(n, 2)
}

export function fmtARS(n) {
  if (n === undefined || n === null || isNaN(n)) return '—'
  return '$ ' + fmt(n, 0)
}
