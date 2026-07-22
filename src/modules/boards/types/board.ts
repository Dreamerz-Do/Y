import type { Visibility } from '@/modules/items/types/item'

export type Role = 'owner' | 'member' | 'guest'

export interface Board {
  id: string
  name: string
  accentHue: number
  defaultVisibility: Visibility
  createdBy: string
}

export interface Member {
  membershipId: string
  userId: string
  name: string
  role: Role
  hue: number
}

export interface Group {
  id: string
  boardId: string
  name: string
  memberIds: string[]
}
