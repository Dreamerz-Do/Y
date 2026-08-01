import { supabase } from '@/shared/lib/supabaseClient'
import type { Session, User } from '@supabase/supabase-js'

// Only place with Supabase auth calls (spec 6.3). Supabase Auth is tied
// directly to the RLS policies, so a signed-in session is all the client needs.

export interface AuthedUser {
  id: string
  email: string | null
}

/** A member of a solely-owned board, eligible to become its next owner. */
export interface HandoverCandidate {
  membershipId: string
  name: string
}

/** A board the signed-in user solely owns while others remain — account
 * deletion needs a successor chosen for it first (spec 4.5). */
export interface HandoverBoard {
  boardId: string
  boardName: string
  candidates: HandoverCandidate[]
}

interface RawHandoverBoard {
  board_id: string
  board_name: string
  candidates: { membership_id: string; name: string }[]
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

  /**
   * Register a new account. Returns the user when a session is created straight
   * away (email confirmation disabled); returns null when the project requires
   * the user to confirm their address first.
   */
  async signUp(email: string, password: string, displayName: string): Promise<AuthedUser | null> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) throw error
    return data.session ? toUser(data.user) : null
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  /**
   * Boards the user solely owns while other members remain — deletion must
   * nominate a successor for each (spec 4.5). Empty when there are none.
   */
  async boardsAwaitingHandover(): Promise<HandoverBoard[]> {
    const { data, error } = await supabase.rpc('boards_awaiting_owner_handover')
    if (error) throw error
    const rows = (data as RawHandoverBoard[] | null) ?? []
    return rows.map((r) => ({
      boardId: r.board_id,
      boardName: r.board_name,
      candidates: r.candidates.map((c) => ({ membershipId: c.membership_id, name: c.name })),
    }))
  },

  /**
   * Delete the signed-in account and the data it owns (spec 4.5 / 8). The work
   * runs in a SECURITY DEFINER function; the client only triggers it and then
   * signs out. `handovers` maps each solely-owned board id to the membership id
   * of the member who should inherit it.
   */
  async deleteAccount(handovers: Record<string, string> = {}): Promise<void> {
    const { error } = await supabase.rpc('delete_current_user', { handovers })
    if (error) throw error
    await supabase.auth.signOut()
  },

  /** Subscribe to session changes; returns an unsubscribe function. */
  onChange(handler: (user: AuthedUser | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      handler(toUser(session?.user ?? null))
    })
    return () => data.subscription.unsubscribe()
  },
}
