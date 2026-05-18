const KEYS = ['suki_simulaciones', 'suki_productos', 'suki_importaciones']

export function exportarTodo() {
  const data = {}
  for (const key of KEYS) {
    try {
      const val = localStorage.getItem(key)
      data[key] = val ? JSON.parse(val) : null
    } catch {
      data[key] = null
    }
  }
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `suki_backup_${fecha}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function importarTodo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        for (const key of KEYS) {
          if (data[key] !== undefined && data[key] !== null) {
            localStorage.setItem(key, JSON.stringify(data[key]))
          }
        }
        resolve()
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Error leyendo el archivo'))
    reader.readAsText(file)
  })
}

export function limpiarTodo() {
  for (const key of KEYS) {
    localStorage.removeItem(key)
  }
}

export function getStats() {
  const stats = {}
  for (const key of KEYS) {
    try {
      const val = localStorage.getItem(key)
      const arr = val ? JSON.parse(val) : []
      stats[key] = Array.isArray(arr) ? arr.length : 0
    } catch {
      stats[key] = 0
    }
  }
  return stats
}
