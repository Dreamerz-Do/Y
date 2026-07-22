import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database'

// The single Supabase client for the app. Only repository modules import this
// (spec 6.3): components and stores never talk to Supabase directly.
//
// The anon key is safe in client code — RLS does the enforcing (hard rule 2).
// The service key is never here and never in any client-triggerable path
// (hard rule 7).
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loudly in development rather than sending requests to nowhere.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local.',
  )
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type TypedSupabaseClient = typeof supabase
