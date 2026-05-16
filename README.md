# Suki — Kyrax Technology

Herramienta interna de Kyrax Technology para calcular costos de importación y pricing en Mercado Libre.

## Features

### Comparativa de Flete
Compara el costo landed total entre **aéreo (courier)** y **marítimo (LCL)** desde China, incluyendo:
- Flete internacional con peso volumétrico real (courier /5000, marítimo W/M)
- Todos los impuestos aduaneros argentinos: DI, Tasa Estadística, IVA, IVA Adicional, Ganancias, IIBB
- Gastos operativos reales: despachante, handling, digitalización, SIM, almacenaje, desconsolidación, depósito fiscal, recargo IMO
- Desglose completo por concepto
- Costo por unidad en USD y ARS

### Calculadora de Pricing — Mercado Libre
Calcula el precio de venta óptimo a partir del costo landed:
- Configurable: %ML, %Ads, %IVA (21% directo sobre precio), %IIBB
- Target de margen sobre precio o sobre costo
- Tabla de 6 escenarios de rentabilidad (10% → 35%)
- Opción de ingresar precio directo y ver el margen resultante
- Precios redondeados a miles

## Stack

- **React 18** + **Vite 5**
- CSS puro con design system Kyrax (light theme)
- Sin dependencias externas (cálculos 100% client-side)

## Setup

```bash
# Instalar dependencias
npm install --strict-ssl=false

# Dev server
npm run dev
# → http://localhost:5173

# Build
npm run build
```

## Estructura

```
src/
├── App.jsx                  # Estado global y layout
├── lib/
│   └── calculations.js      # Motor de cálculo (flete + impuestos + pricing)
├── components/
│   ├── Header.jsx
│   ├── InputPanel.jsx       # Formulario de datos del producto
│   ├── ResultsPanel.jsx     # Comparativa aéreo vs marítimo
│   └── PricingPanel.jsx     # Calculadora de pricing ML
└── styles/
    └── kyrax.css            # Design system
```

## Metodología de cálculo

### Flete aéreo (courier)
`Peso facturable = max(peso real, largo×ancho×alto×bultos / 5000)`
`CIF = FOB + flete + seguro`

### Flete marítimo (LCL)
`W/M = max(toneladas, m³)` — mínimo USD 200
`CIF = FOB + flete×W/M + recargo IMO + seguro`

### Impuestos sobre CIF
`Base imponible = CIF + DI + Tasa Estadística`
`Percepciones = IVA + IVA Adicional + Ganancias + IIBB`

### Pricing ML
`Neto unitario = Precio × (1 - %ML - %Ads - %IVA - %IIBB)`
`Precio = Costo ARS / (factor_neto - margen_target)`

---

Kyrax Technology · Buenos Aires, Argentina
