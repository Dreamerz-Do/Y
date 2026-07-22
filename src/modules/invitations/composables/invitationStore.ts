import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invitationRepository } from '../api/invitationRepository'
import type { Invitation, PendingInvitation } from '../types/invitation'

// Server-data store for the invitations domain (spec 6.4). Two independent
// views: the invitations an owner has sent per board, and the caller's own
// outstanding invitations across boards.
export const useInvitationStore = defineStore('invitations', () => {
  const mine = ref<PendingInvitation[]>([])
  const byBoard = ref<Record<string, Invitation[]>>({})
  const loading = ref(false)

  async function loadMine(): Promise<void> {
    loading.value = true
    try {
      mine.value = await invitationRepository.listMine()
    } finally {
      loading.value = false
    }
  }

  async function loadForBoard(boardId: string): Promise<void> {
    byBoard.value = {
      ...byBoard.value,
      [boardId]: await invitationRepository.listForBoard(boardId),
    }
  }

  async function invite(boardId: string, email: string, role: Invitation['role']): Promise<void> {
    await invitationRepository.create(boardId, email, role)
    await loadForBoard(boardId)
  }

  async function accept(invitationId: string): Promise<void> {
    await invitationRepository.accept(invitationId)
    await loadMine()
  }

  async function decline(invitationId: string): Promise<void> {
    await invitationRepository.decline(invitationId)
    await loadMine()
  }

  async function withdraw(boardId: string, invitationId: string): Promise<void> {
    await invitationRepository.remove(invitationId)
    await loadForBoard(boardId)
  }

  function invitationsOf(boardId: string): Invitation[] {
    return byBoard.value[boardId] ?? []
  }

  return {
    mine,
    byBoard,
    loading,
    loadMine,
    loadForBoard,
    invite,
    accept,
    decline,
    withdraw,
    invitationsOf,
  }
})
