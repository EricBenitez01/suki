import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('[Suki] Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env')
}

export const supabase = createClient(url || 'http://localhost', key || 'placeholder')
