import { supabase } from '@/shared/lib/supabaseClient'
import type { Session, User } from '@supabase/supabase-js'

// Only place with Supabase auth calls (spec 6.3). Supabase Auth is tied
// directly to the RLS policies, so a signed-in session is all the client needs.

export interface AuthedUser {
  id: string
  email: string | null
}

function toUser(user: User | null): AuthedUser | null {
  if (!user) return null
  return { id: user.id, email: user.email ?? null }
}

export const authRepository = {
  async currentUser(): Promise<AuthedUser | null> {
    const { data } = await supabase.auth.getUser()
    return toUser(data.user)
  },

  async signIn(email: string, password: string): Promise<AuthedUser> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const user = toUser(data.user)
    if (!user) throw new Error('Sign-in returned no user')
    return user
  },

  async signUp(email: string, password: string, displayName: string): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) throw error
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  /** Subscribe to session changes; returns an unsubscribe function. */
  onChange(handler: (user: AuthedUser | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      handler(toUser(session?.user ?? null))
    })
    return () => data.subscription.unsubscribe()
  },
}
