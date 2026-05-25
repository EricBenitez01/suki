import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastContext = createContext(null)

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [])

  const bg = type === 'success' ? 'var(--pos)' : type === 'error' ? 'var(--neg)' : 'var(--brand)'
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'

  return (
    <div style={{
      position: 'fixed', top: 28, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: bg, color: '#fff',
      padding: '13px 28px', borderRadius: 12,
      fontWeight: 700, fontSize: 14,
      boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', gap: 10,
      whiteSpace: 'nowrap',
      animation: 'toast-slide-in 0.22s cubic-bezier(.22,1,.36,1)',
      pointerEvents: 'none',
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      {message}
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
