import type { Role } from '@/modules/boards/types/board'

export type InvitationStatus = 'pending' | 'accepted' | 'declined'

/** An invitation as its board's owner sees it (spec 4.4). */
export interface Invitation {
  id: string
  boardId: string
  email: string
  role: Role
  status: InvitationStatus
}

/**
 * An outstanding invitation as the invited user sees it. The board name is the
 * only board detail they may read before accepting (they are not a member yet).
 */
export interface PendingInvitation {
  id: string
  boardId: string
  boardName: string
  role: Role
}
