import { useState, useEffect, useRef } from 'react'

const WA_LINK = 'https://wa.me/5491162717179?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Suki'
const IG_LINK = 'https://instagram.com/kyrax.technology'

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ to, suffix = '', duration = 1800 }) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      let start = null
      const step = (ts) => {
        if (!start) start = ts
        const progress = Math.min((ts - start) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(Math.floor(eased * to))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [to, duration])
  return <span ref={ref}>{value.toLocaleString('es-AR')}{suffix}</span>
}

// ─── Pain card ────────────────────────────────────────────────────────────────
function PainCard({ emoji, pain, fix }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '24px 20px', backdropFilter: 'blur(10px)',
      transition: 'transform 0.2s, border-color 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
    >
      <div style={{ fontSize: 28, marginBottom: 12 }}>{emoji}</div>
      <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, marginBottom: 12 }}>{pain}</p>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ color: '#22d3ee', fontSize: 14, flexShrink: 0, marginTop: 1 }}>→</span>
        <p style={{ fontSize: 13, color: '#22d3ee', lineHeight: 1.5, fontWeight: 600 }}>{fix}</p>
      </div>
    </div>
  )
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, accent }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${accent}33`,
      borderRadius: 16, padding: '28px 24px',
      transition: 'transform 0.2s, background 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.background = `${accent}0d` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: `${accent}1a`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, marginBottom: 16,
      }}>{icon}</div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65 }}>{desc}</p>
    </div>
  )
}

// ─── Pricing card ─────────────────────────────────────────────────────────────
function PricingCard({ plan, price, desc, features, highlighted, cta }) {
  return (
    <div style={{
      background: highlighted ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : 'rgba(255,255,255,0.04)',
      border: highlighted ? 'none' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 20, padding: '32px 28px',
      transform: highlighted ? 'scale(1.05)' : 'scale(1)',
      boxShadow: highlighted ? '0 20px 60px rgba(99,102,241,0.4)' : 'none',
      display: 'flex', flexDirection: 'column',
    }}>
      {highlighted && (
        <div style={{
          background: '#fbbf24', color: '#000', fontSize: 11, fontWeight: 800,
          padding: '4px 12px', borderRadius: 99, width: 'fit-content',
          marginBottom: 16, letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          Más popular
        </div>
      )}
      <div style={{ fontSize: 13, fontWeight: 700, color: highlighted ? 'rgba(255,255,255,0.8)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{plan}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: highlighted ? 'rgba(255,255,255,0.7)' : '#64748b' }}>USD</span>
        <span style={{ fontSize: 42, fontWeight: 900, color: '#f1f5f9', fontFamily: 'monospace' }}>{price}</span>
        <span style={{ fontSize: 13, color: highlighted ? 'rgba(255,255,255,0.7)' : '#64748b' }}>/mes</span>
      </div>
      <p style={{ fontSize: 13, color: highlighted ? 'rgba(255,255,255,0.75)' : '#64748b', marginBottom: 24, lineHeight: 1.5 }}>{desc}</p>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32, flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: highlighted ? 'rgba(255,255,255,0.9)' : '#cbd5e1', lineHeight: 1.4 }}>
            <span style={{ color: highlighted ? '#a5f3fc' : '#22d3ee', flexShrink: 0, marginTop: 1 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      <a
        href={WA_LINK}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block', textAlign: 'center', padding: '14px',
          borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none',
          background: highlighted ? '#fff' : 'rgba(255,255,255,0.08)',
          color: highlighted ? '#4f46e5' : '#f1f5f9',
          border: highlighted ? 'none' : '1px solid rgba(255,255,255,0.15)',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        {cta}
      </a>
    </div>
  )
}

// ─── Main Landing ──────────────────────────────────────────────────────────────
export default function LandingPage({ onLogin }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div style={{ background: '#080c18', color: '#f1f5f9', fontFamily: '-apple-system,"Segoe UI",Helvetica,Arial,sans-serif', overflowX: 'hidden' }}>

      {/* Ambient background blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', animation: 'pulse 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '30%', right: '-15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 70%)', animation: 'pulse 10s ease-in-out infinite 2s' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '20%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', animation: 'pulse 12s ease-in-out infinite 4s' }} />
        {/* Grid pattern */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '60px 60px', opacity: 0.5 }} />
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.1);opacity:0.7} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        .landing-btn-primary { display:inline-flex;align-items:center;gap:10px;padding:16px 32px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;transition:transform 0.2s,box-shadow 0.2s;box-shadow:0 4px 20px rgba(99,102,241,0.4); }
        .landing-btn-primary:hover { transform:translateY(-2px);box-shadow:0 8px 30px rgba(99,102,241,0.6); }
        .landing-btn-ghost { display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border:1px solid rgba(255,255,255,0.2);color:#f1f5f9;border-radius:12px;font-weight:600;font-size:14px;text-decoration:none;transition:all 0.2s;background:rgba(255,255,255,0.05); }
        .landing-btn-ghost:hover { background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.35); }
        .gradient-text { background:linear-gradient(135deg,#818cf8 0%,#22d3ee 50%,#a78bfa 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 4s linear infinite; }
        .step-line::after { content:'';position:absolute;top:50%;left:100%;width:100%;height:2px;background:linear-gradient(90deg,rgba(99,102,241,0.5),transparent);transform:translateY(-50%); }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(8,12,24,0.9)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : 'none',
        transition: 'all 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>S</div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>Suki</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: 99, letterSpacing: '0.05em' }}>BETA</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="#pricing" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }} onMouseEnter={e => e.target.style.color='#f1f5f9'} onMouseLeave={e => e.target.style.color='#94a3b8'}>Precios</a>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="landing-btn-ghost" style={{ padding: '8px 18px', fontSize: 13 }}>
            <span>💬</span> WhatsApp
          </a>
          <button onClick={onLogin} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Ingresar →
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px' }}>
        <div style={{ animation: 'fadeInUp 0.8s ease both' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 99, padding: '6px 16px', fontSize: 12, fontWeight: 700, color: '#818cf8', marginBottom: 32, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            ✦ El OS del importador-vendedor de Mercado Libre
          </div>

          <h1 style={{ fontSize: 'clamp(36px, 7vw, 72px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-1.5px', marginBottom: 24, maxWidth: 900 }}>
            Sabé exactamente<br />
            <span className="gradient-text">cuánto ganás</span><br />
            antes de importar
          </h1>

          <p style={{ fontSize: 'clamp(16px, 2.5vw, 20px)', color: '#94a3b8', maxWidth: 600, margin: '0 auto 48px', lineHeight: 1.7 }}>
            Cotizador de flete aéreo y marítimo con impuestos aduaneros argentinos, pricing ML automatizado y dashboard de salud de tu negocio. Todo en un lugar.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="landing-btn-primary">
              <span>💬</span> Quiero probarlo gratis
            </a>
            <a href={IG_LINK} target="_blank" rel="noopener noreferrer" className="landing-btn-ghost">
              <span>📸</span> Seguinos en Instagram
            </a>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          marginTop: 80, display: 'flex', gap: 0, justifyContent: 'center',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20, padding: '28px 48px', flexWrap: 'wrap',
          backdropFilter: 'blur(10px)', animation: 'fadeInUp 0.8s ease 0.3s both',
          maxWidth: 800, width: '100%',
        }}>
          {[
            { n: 60, suffix: 'seg', label: 'para cotizar un lote completo' },
            { n: 100, suffix: '%', label: 'de los impuestos aduaneros calculados' },
            { n: 0, suffix: ' planillas', label: 'de Excel necesarias' },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, minWidth: 160, textAlign: 'center', padding: '0 24px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
              <div style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 900, color: '#f1f5f9', fontFamily: 'monospace' }}>
                <Counter to={s.n} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', animation: 'float 2s ease-in-out infinite', opacity: 0.4, fontSize: 20 }}>↓</div>
      </section>

      {/* ── PAINS ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>¿Te suena familiar?</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.15 }}>
            Los dolores de importar<br />y vender en ML
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          <PainCard emoji="📊"
            pain="Calculás en Excel, te olvidás del DI, el IVA de importación, Ganancias, IIBB… y cuando llega la mercadería ya importaste a pérdida."
            fix="Suki tiene todos los impuestos aduaneros argentinos hardcodeados. No se te escapa nada." />
          <PainCard emoji="⏰"
            pain="Conseguir una cotización de flete te lleva horas: forwarding, agente de aduana, broker. Multiplicado por cada proveedor que evaluás."
            fix="Comparativa aéreo vs marítimo en 60 segundos, con costo landed por unidad." />
          <PainCard emoji="💸"
            pain="Fijás precio en ML sin considerar la comisión (25%), IVA de ML, IIBB, publicidad. Vendés y ganás menos de lo que creías."
            fix="Calculadora de precios ML que descuenta todo automáticamente y te da el margen real." />
          <PainCard emoji="🔴"
            pain="No sabés en tiempo real cuáles de tus publicaciones están ganando y cuáles perdiendo plata. Te enterás tarde."
            fix="Dashboard de salud con semáforos: verde, amarillo, rojo. Un vistazo y sabés dónde actuar." />
          <PainCard emoji="📦"
            pain="Cada importación es una caja negra. Vendiste 40 unidades, ¿recuperaste la inversión? ¿cuánto ganaste realmente?"
            fix="P&L por lote: costo total vs revenue generado vs ganancia real." />
          <PainCard emoji="🔄"
            pain="Tus publicaciones de ML, tus costos y tus márgenes viven en lugares distintos. Nunca tenés la foto completa."
            fix="Sync con ML + catálogo + cotizador en una sola pantalla. Un sistema, no cinco planillas." />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>La solución</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.15 }}>
            Todo lo que necesitás<br />para importar con inteligencia
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          <FeatureCard icon="⚖️" accent="#6366f1"
            title="Cotizador de flete"
            desc="Comparativa aéreo vs marítimo con estructura aduanera argentina completa: DI por NCM, IVA de importación, Ganancias, Estadística, Despachante y más." />
          <FeatureCard icon="💰" accent="#14b8a6"
            title="Pricing ML automatizado"
            desc="Ingresás tu costo y target de margen. Suki calcula el precio óptimo descontando comisión ML, IVA, IIBB, publicidad y todos los costos variables." />
          <FeatureCard icon="📊" accent="#8b5cf6"
            title="Dashboard de salud"
            desc="Semáforo en tiempo real de cada publicación: margen real, stock crítico, productos en pérdida. Dejás de adivinar y empezás a actuar con datos." />
          <FeatureCard icon="🛍️" accent="#f59e0b"
            title="Catálogo inteligente"
            desc="Cada producto con su costo landed real vinculado a la importación que lo originó. Un historial completo de lo que costó traer cada SKU." />
          <FeatureCard icon="🔗" accent="#22d3ee"
            title="Sync con Mercado Libre"
            desc="Conectá tu cuenta ML con OAuth. Suki sincroniza todas tus publicaciones: precio real, stock, ventas. El puente entre tu inventario y ML." />
          <FeatureCard icon="📦" accent="#ef4444"
            title="P&L por importación"
            desc="Registrá cada lote con proveedores, links de Alibaba y costos. Ve en tiempo real cuánto vendiste de cada lote y cuánto te falta para recuperar la inversión." />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '100px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>Cómo funciona</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, letterSpacing: '-0.5px' }}>
            De FOB China a margen real en 3 pasos
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
          {[
            { n: '01', title: 'Cotizás antes de comprar', desc: 'Ingresás el FOB, NCM, peso y cantidad. Suki te da el costo landed real con todos los impuestos. Sabés si conviene antes de pagar.', color: '#6366f1' },
            { n: '02', title: 'Calculás el precio justo', desc: 'Con el costo landed calculado, Suki te dice a qué precio publicar en ML para llegar a tu margen objetivo. Sin sorpresas.', color: '#8b5cf6' },
            { n: '03', title: 'Monitoreás tu negocio', desc: 'Sincronizás ML y el Dashboard te muestra en segundos qué productos te ganan y cuáles te pierden. Actuás antes de que sea tarde.', color: '#22d3ee' },
          ].map((step, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '32px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: `linear-gradient(135deg, ${step.color}33, ${step.color}11)`,
                border: `2px solid ${step.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 16, fontWeight: 900, color: step.color, fontFamily: 'monospace',
              }}>{step.n}</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', marginBottom: 12 }}>{step.title}</h3>
              <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 24px', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, padding: '48px 40px', backdropFilter: 'blur(10px)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 24, animation: 'float 3s ease-in-out infinite' }}>🚀</div>
          <blockquote style={{ fontSize: 'clamp(16px,2.5vw,20px)', color: '#cbd5e1', lineHeight: 1.7, fontStyle: 'italic', marginBottom: 24 }}>
            "Antes tardaba un día entero en cotizar si me convenía traer un producto de China. Ahora lo hago en 2 minutos y tengo el precio de ML calculado al instante."
          </blockquote>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>K</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Eric — Kyrax Technology</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Importador · Vendedor ML · Early adopter</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ position: 'relative', zIndex: 1, padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>Precios</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 16 }}>
            Empezá gratis, crecé con tu negocio
          </h2>
          <p style={{ fontSize: 15, color: '#64748b' }}>En beta, todos los planes con acceso completo. Contactanos por WhatsApp para activar.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, alignItems: 'start' }}>
          <PricingCard
            plan="Starter"
            price="19"
            desc="Para importadores que están empezando a ordenar sus números."
            features={[
              'Cotizador flete aéreo + marítimo',
              'Impuestos aduaneros completos',
              'Pricing ML con tabla de escenarios',
              'Historial de 10 simulaciones',
              '5 productos en catálogo',
            ]}
            cta="Empezar gratis →"
          />
          <PricingCard
            plan="Pro"
            price="49"
            desc="Para sellers que quieren el control total de su operación."
            features={[
              'Todo lo de Starter',
              'Catálogo ilimitado',
              'Sync con Mercado Libre',
              'Dashboard de salud en tiempo real',
              'P&L por importación',
              'Alertas de stock crítico',
              'Auto-vinculación ML ↔ catálogo',
            ]}
            highlighted
            cta="Quiero el Pro"
          />
          <PricingCard
            plan="Business"
            price="99"
            desc="Para equipos y sellers con operaciones más complejas."
            features={[
              'Todo lo de Pro',
              'Múltiples usuarios',
              'Múltiples cuentas ML',
              'Export para contador (CSV)',
              'Soporte prioritario',
              'Onboarding personalizado',
            ]}
            cta="Hablar con ventas →"
          />
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ position: 'relative', zIndex: 1, padding: '100px 24px 140px', textAlign: 'center' }}>
        <div style={{
          maxWidth: 700, margin: '0 auto',
          background: 'linear-gradient(135deg, rgba(79,70,229,0.2) 0%, rgba(124,58,237,0.15) 100%)',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 28, padding: '64px 40px',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 24, animation: 'float 3s ease-in-out infinite' }}>⚡</div>
          <h2 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 16, lineHeight: 1.2 }}>
            Dejá de improvisar.<br />Empezá a importar con datos.
          </h2>
          <p style={{ fontSize: 15, color: '#94a3b8', marginBottom: 40, lineHeight: 1.6 }}>
            Suki está en beta y el acceso es limitado. Contactanos ahora y te damos acceso gratis durante el período beta.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="landing-btn-primary" style={{ fontSize: 16, padding: '18px 36px' }}>
              💬 Quiero acceso beta gratis
            </a>
            <a href={IG_LINK} target="_blank" rel="noopener noreferrer" className="landing-btn-ghost" style={{ fontSize: 14 }}>
              📸 @kyrax.technology
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff' }}>S</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#64748b' }}>Suki by Kyrax Technology</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }} onMouseEnter={e=>e.target.style.color='#94a3b8'} onMouseLeave={e=>e.target.style.color='#475569'}>WhatsApp</a>
          <a href={IG_LINK} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }} onMouseEnter={e=>e.target.style.color='#94a3b8'} onMouseLeave={e=>e.target.style.color='#475569'}>Instagram</a>
          <button onClick={onLogin} style={{ fontSize: 13, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onMouseEnter={e=>e.target.style.color='#94a3b8'} onMouseLeave={e=>e.target.style.color='#475569'}>Ingresar</button>
        </div>
      </footer>

    </div>
  )
}
