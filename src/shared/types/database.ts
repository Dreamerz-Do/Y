/**
 * Database types.
 *
 * ⚠️ REGENERATE, DO NOT HAND-EDIT.
 *
 * The project convention (CLAUDE.md hard rules) is that these types are
 * *generated* from the Postgres schema, never hand-written:
 *
 *     npm run db:types    # supabase gen types typescript --local > this file
 *
 * This file was authored to mirror the initial migration
 * (supabase/migrations/20260722090000_initial_schema.sql) exactly, because the
 * build sandbox cannot pull the Supabase Docker images (the egress proxy blocks
 * the container registry CDN), so `supabase gen types` could not be run here.
 * On the first environment that can run the local stack — or in CI against a
 * throwaway instance — regenerate this file with the command above and commit
 * the result. The shape below is the generator's own format, so the diff should
 * be minimal.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          color_hue: number | null
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string
          color_hue?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          color_hue?: number | null
          created_at?: string
        }
        Relationships: []
      }
      boards: {
        Row: {
          id: string
          name: string
          accent_hue: number
          default_visibility: Database['public']['Enums']['item_visibility']
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          accent_hue?: number
          default_visibility?: Database['public']['Enums']['item_visibility']
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          accent_hue?: number
          default_visibility?: Database['public']['Enums']['item_visibility']
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          id: string
          board_id: string
          user_id: string
          role: Database['public']['Enums']['board_role']
          created_at: string
        }
        Insert: {
          id?: string
          board_id: string
          user_id: string
          role?: Database['public']['Enums']['board_role']
          created_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          user_id?: string
          role?: Database['public']['Enums']['board_role']
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_board_id_fkey'
            columns: ['board_id']
            isOneToOne: false
            referencedRelation: 'boards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memberships_user_id_profiles_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      groups: {
        Row: {
          id: string
          board_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          board_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'groups_board_id_fkey'
            columns: ['board_id']
            isOneToOne: false
            referencedRelation: 'boards'
            referencedColumns: ['id']
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          membership_id: string
        }
        Insert: {
          group_id: string
          membership_id: string
        }
        Update: {
          group_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'group_members_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'memberships'
            referencedColumns: ['id']
          },
        ]
      }
      items: {
        Row: {
          id: string
          board_id: string
          title: string
          notes: string | null
          assignee_id: string | null
          starts_at: string | null
          ends_at: string | null
          all_day: boolean
          is_done: boolean
          visibility: Database['public']['Enums']['item_visibility']
          reveal_owner: boolean
          color: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          title: string
          notes?: string | null
          assignee_id?: string | null
          starts_at?: string | null
          ends_at?: string | null
          all_day?: boolean
          is_done?: boolean
          visibility?: Database['public']['Enums']['item_visibility']
          reveal_owner?: boolean
          color?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          title?: string
          notes?: string | null
          assignee_id?: string | null
          starts_at?: string | null
          ends_at?: string | null
          all_day?: boolean
          is_done?: boolean
          visibility?: Database['public']['Enums']['item_visibility']
          reveal_owner?: boolean
          color?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'items_board_id_fkey'
            columns: ['board_id']
            isOneToOne: false
            referencedRelation: 'boards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'items_assignee_id_fkey'
            columns: ['assignee_id']
            isOneToOne: false
            referencedRelation: 'memberships'
            referencedColumns: ['id']
          },
        ]
      }
      item_shares: {
        Row: {
          item_id: string
          membership_id: string | null
          group_id: string | null
        }
        Insert: {
          item_id: string
          membership_id?: string | null
          group_id?: string | null
        }
        Update: {
          item_id?: string
          membership_id?: string | null
          group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'item_shares_item_id_fkey'
            columns: ['item_id']
            isOneToOne: false
            referencedRelation: 'items'
            referencedColumns: ['id']
          },
        ]
      }
      invitations: {
        Row: {
          id: string
          board_id: string
          email: string
          role: Database['public']['Enums']['board_role']
          status: Database['public']['Enums']['invitation_status']
          invited_by: string
          created_at: string
        }
        Insert: {
          id?: string
          board_id: string
          email: string
          role?: Database['public']['Enums']['board_role']
          status?: Database['public']['Enums']['invitation_status']
          invited_by: string
          created_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          email?: string
          role?: Database['public']['Enums']['board_role']
          status?: Database['public']['Enums']['invitation_status']
          invited_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invitations_board_id_fkey'
            columns: ['board_id']
            isOneToOne: false
            referencedRelation: 'boards'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      calendar_busy_blocks: {
        Row: {
          id: string | null
          board_id: string | null
          starts_at: string | null
          ends_at: string | null
          all_day: boolean | null
          owner_name: string | null
          owner_id: string | null
        }
        Relationships: []
      }
      my_pending_invitations: {
        Row: {
          id: string | null
          board_id: string | null
          board_name: string | null
          role: Database['public']['Enums']['board_role'] | null
          created_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_board_member: {
        Args: { b: string }
        Returns: boolean
      }
      board_role_of: {
        Args: { b: string }
        Returns: Database['public']['Enums']['board_role']
      }
      is_board_owner: {
        Args: { b: string }
        Returns: boolean
      }
      can_edit_others: {
        Args: { b: string }
        Returns: boolean
      }
      my_membership_id: {
        Args: { b: string }
        Returns: string
      }
      owner_count: {
        Args: { b: string }
        Returns: number
      }
      create_invitation: {
        Args: {
          b: string
          target_email: string
          target_role?: Database['public']['Enums']['board_role']
        }
        Returns: Database['public']['Tables']['invitations']['Row']
      }
      accept_invitation: {
        Args: { inv: string }
        Returns: undefined
      }
      delete_current_user: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_board: {
        Args: { board_name: string; accent?: number }
        Returns: Database['public']['Tables']['boards']['Row']
      }
      delete_board: {
        Args: { b: string }
        Returns: undefined
      }
      leave_board: {
        Args: { b: string; receiver?: string }
        Returns: undefined
      }
      remove_member: {
        Args: { m: string }
        Returns: undefined
      }
    }
    Enums: {
      board_role: 'owner' | 'member' | 'guest'
      item_visibility: 'board' | 'private' | 'shared_with'
      invitation_status: 'pending' | 'accepted' | 'declined'
    }
    CompositeTypes: Record<never, never>
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
