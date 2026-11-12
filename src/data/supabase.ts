import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://tkhjbtdipmabfuigasae.supabase.co'
const key =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? 'sb_publishable_Bm7CxekG109-eP612YYANA_IOm-78Ac'

export const supabase = createClient<Database>(url, key, {
  auth: { storageKey: 'zz-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
