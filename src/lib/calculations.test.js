import { describe, test, expect } from 'vitest'
import { calcularComparativa, calcPricing, DEFAULTS } from './calculations.js'

// Base inputs reusable across tests
function base(overrides = {}) {
  return {
    ...DEFAULTS,
    fob: 1000,
    unidades: 10,
    pesoKg: 10,
    di: 35,
    tc: 1000,
    largoCm: '', anchoCm: '', altoCm: '', bultos: '',
    fleteAereoModo: 'calculado',
    fleteAereoCotizacion: '',
    ...overrides,
  }
}

describe('Cadena aduanera — calcularComparativa', () => {
  test('aéreo: FOB simple, sin dimensiones, DI 35%', () => {
    const r = calcularComparativa(base())
    expect(r).not.toBeNull()
    // pesoFacturable = pesoReal (sin dims)
    expect(r.aereo.pesoFacturable).toBe(10)
    // fleteAereo = 10kg * USD23
    expect(r.aereo.fleteAereo).toBeCloseTo(230, 2)
    // CIF = 1000 + 230 = 1230
    expect(r.aereo.cif).toBeCloseTo(1230, 2)
    // DI = 1230 * 35% = 430.5; baseImponible = 1230 + 430.5 = 1660.5
    expect(r.aereo.diAmt).toBeCloseTo(430.5, 2)
    expect(r.aereo.baseImponible).toBeCloseTo(1660.5, 2)
    // totalUSD = CIF + impuestos + handlingAereo(60)
    expect(r.aereo.totalUSD).toBeCloseTo(2202.045, 2)
    expect(r.aereo.costoUnitUSD).toBeCloseTo(220.2045, 2)
    expect(r.aereo.totalARS).toBeCloseTo(2202045, 0)
  })

  test('aéreo: peso volumétrico > peso real', () => {
    const r = calcularComparativa(base({
      fob: 200, unidades: 2, pesoKg: 1, di: 20,
      largoCm: 50, anchoCm: 40, altoCm: 30, bultos: 2,
    }))
    // pesoVol = (50*40*30*2)/5000 = 24kg > 1kg real
    expect(r.aereo.pesoFacturable).toBeCloseTo(24, 2)
    // fleteAereo = 24 * 23 = 552
    expect(r.aereo.fleteAereo).toBeCloseTo(552, 2)
    expect(r.aereo.totalUSD).toBeCloseTo(1224.096, 2)
    expect(r.aereo.costoUnitUSD).toBeCloseTo(612.048, 2)
  })

  test('marítimo: flete mínimo USD 200 en embarque liviano', () => {
    const r = calcularComparativa(base({ fob: 500, unidades: 5, pesoKg: 0.1, di: 0 }))
    // wm = 0.0001 ton → 0.0001*200=0.02 → mínimo 200
    expect(r.maritimo.fleteMaritimo).toBeCloseTo(200, 2)
    // seguro mínimo USD 100
    expect(r.maritimo.seguro).toBeCloseTo(100, 2)
    expect(r.maritimo.totalUSD).toBeCloseTo(3235.5, 1)
    expect(r.maritimo.costoUnitUSD).toBeCloseTo(647.1, 1)
  })

  test('marítimo: W/M por toneladas > m³, desconsolidación calculada', () => {
    const r = calcularComparativa(base({
      fob: 5000, unidades: 20, pesoKg: 2000, di: 15,
      largoCm: 30, anchoCm: 20, altoCm: 15, bultos: 10,
    }))
    // cbm = (30*20*15*10)/1_000_000 = 0.09m³; ton = 2
    // wm = max(2, 0.09) = 2 → flete = 2*200 = 400 (no mínimo)
    expect(r.maritimo.fleteMaritimo).toBeCloseTo(400, 2)
    // desconsolidacion = min(max(2*25, 50), 350) = min(50, 350) = 50
    expect(r.maritimo.desconsolidacion).toBeCloseTo(50, 2)
  })
})

describe('Pricing ML — casos planilla (TC 1399.23, IVA 14%, IIBB 0%)', () => {
  // Helper: dado un precio conocido, calcula netoUnitario y margenUnitario
  function fromPrecio({ costoARS, precio, mlPct, adsPct = 12, ivaPct = 14, iibbPct = 0, otrosPct = 0 }) {
    const factorNeto = 1 - mlPct / 100 - adsPct / 100 - ivaPct / 100 - iibbPct / 100 - otrosPct / 100
    const netoUnitario = precio * factorNeto
    const margenUnitario = netoUnitario - costoARS
    return { netoUnitario, margenUnitario }
  }

  // Tolerancia ±50 ARS (redondeos de planilla)
  const PREC = -2

  test('Camara Deportiva — precio $180.000, ML 19.67%', () => {
    const r = fromPrecio({ costoARS: 54312.60, precio: 180000, mlPct: 19.67 })
    expect(r.netoUnitario).toBeCloseTo(97800, PREC)
    expect(r.margenUnitario).toBeCloseTo(43487, PREC)
  })

  test('Camara Pro — precio $290.000, ML 27.38%', () => {
    const r = fromPrecio({ costoARS: 69961.62, precio: 290000, mlPct: 27.38 })
    expect(r.netoUnitario).toBeCloseTo(135210, PREC)
    expect(r.margenUnitario).toBeCloseTo(65248, PREC)
  })

  test('Teclado RGB — precio $68.000, ML 31.21%', () => {
    const r = fromPrecio({ costoARS: 17161.58, precio: 68000, mlPct: 31.21 })
    expect(r.netoUnitario).toBeCloseTo(29100, PREC)
    expect(r.margenUnitario).toBeCloseTo(11938, PREC)
  })

  test('Funda iPad — precio $163.000, ML 29.88%', () => {
    const r = fromPrecio({ costoARS: 31016.32, precio: 163000, mlPct: 29.88 })
    expect(r.netoUnitario).toBeCloseTo(71911, PREC)
    expect(r.margenUnitario).toBeCloseTo(40894, PREC)
  })

  test('Anillo Magnético — precio $12.000, ML 25.69%, sin ads', () => {
    const r = fromPrecio({ costoARS: 5065.22, precio: 12000, mlPct: 25.69, adsPct: 0 })
    expect(r.netoUnitario).toBeCloseTo(7237, PREC)
    expect(r.margenUnitario).toBeCloseTo(2171, PREC)
  })

  test('Tablet E10 Modelo 2 — precio $610.000, ML 23.07%', () => {
    const r = fromPrecio({ costoARS: 155734.56, precio: 610000, mlPct: 23.07 })
    expect(r.netoUnitario).toBeCloseTo(310700, PREC)
    expect(r.margenUnitario).toBeCloseTo(154965, PREC)
  })

  test('calcPricing — target margen 20% sobre precio', () => {
    const r = calcPricing({
      costoARS: 50000, mlPct: 25, adsPct: 12, ivaPct: 14,
      iibbPct: 0, otrosPct: 0, targetMargen: 20, modoTarget: 'precio',
    })
    expect(r).not.toBeNull()
    // factorNeto = 1 - 0.25 - 0.12 - 0.14 = 0.49
    // precio = 50000 / (0.49 - 0.20) = 50000 / 0.29 ≈ 172413.79
    expect(r.precio).toBeCloseTo(172413.79, 0)
    expect(r.netoUnitario).toBeCloseTo(r.precio * 0.49, 1)
    expect(r.margenUnitario).toBeCloseTo(r.netoUnitario - 50000, 1)
  })
})
