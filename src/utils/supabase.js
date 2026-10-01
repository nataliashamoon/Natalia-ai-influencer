import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled = Boolean(url && key)

// Without Supabase env vars (fresh clone, self-hosting) the app must still run:
// sign-in is hidden and everything stays in the browser. The stub mirrors the
// small slice of the client the app touches so callers don't need null checks.
function createStub() {
  const noSession = Promise.resolve({ data: { session: null }, error: null })
  const notConfigured = Promise.resolve({ data: null, error: { message: 'Sign-in is not configured on this deployment' } })
  const query = () => {
    const chain = {
      select: () => chain, insert: () => chain, upsert: () => chain, update: () => chain,
      delete: () => chain, eq: () => chain, in: () => chain, order: () => chain,
      single: () => chain, maybeSingle: () => chain, limit: () => chain,
      then: (res, rej) => Promise.resolve({ data: null, error: null }).then(res, rej),
    }
    return chain
  }
  return {
    auth: {
      getSession: () => noSession,
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithOAuth: () => notConfigured,
      signOut: () => Promise.resolve({ error: null }),
      exchangeCodeForSession: () => notConfigured,
    },
    from: query,
  }
}

export const supabase = supabaseEnabled ? createClient(url, key) : createStub()
