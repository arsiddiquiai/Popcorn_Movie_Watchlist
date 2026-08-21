import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env (copy .env.example to get started), then restart the dev server.',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
