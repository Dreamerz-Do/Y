import { defineStore } from 'pinia'
import { ref } from 'vue'
import { boardRepository, type BoardPatch } from '../api/boardRepository'
import { groupRepository } from '../api/groupRepository'
import type { Board, Group, Member, Role } from '../types/board'

// Server-data store for the boards domain (spec 6.4). The boards domain covers
// board, membership and groups (spec 6.2). Fed only by the repository layer;
// components never call Supabase themselves.
export const useBoardStore = defineStore('boards', () => {
  const boards = ref<Board[]>([])
  const membersByBoard = ref<Record<string, Member[]>>({})
  const groupsByBoard = ref<Record<string, Group[]>>({})
  const loading = ref(false)

  async function loadBoards(): Promise<void> {
    loading.value = true
    try {
      boards.value = await boardRepository.list()
    } finally {
      loading.value = false
    }
  }

  async function loadMembers(boardId: string): Promise<void> {
    membersByBoard.value = {
      ...membersByBoard.value,
      [boardId]: await boardRepository.members(boardId),
    }
  }

  async function loadGroups(boardId: string): Promise<void> {
    groupsByBoard.value = {
      ...groupsByBoard.value,
      [boardId]: await groupRepository.listByBoard(boardId),
    }
  }

  async function changeRole(boardId: string, membershipId: string, role: Role): Promise<void> {
    await boardRepository.updateRole(membershipId, role)
    await loadMembers(boardId)
  }

  async function removeMember(boardId: string, membershipId: string): Promise<void> {
    await boardRepository.removeMember(membershipId)
    await loadMembers(boardId)
  }

  /** The signed-in user leaves a board (spec 4.5). An owner passes the receiving
   * owner's membership id; the board disappears from their list. */
  async function leaveBoard(boardId: string, receiverMembershipId?: string): Promise<void> {
    await boardRepository.leave(boardId, receiverMembershipId)
    boards.value = boards.value.filter((b) => b.id !== boardId)
  }

  async function createGroup(boardId: string, name: string): Promise<void> {
    await groupRepository.create(boardId, name)
    await loadGroups(boardId)
  }

  async function renameGroup(boardId: string, groupId: string, name: string): Promise<void> {
    await groupRepository.rename(groupId, name)
    await loadGroups(boardId)
  }

  async function removeGroup(boardId: string, groupId: string): Promise<void> {
    await groupRepository.remove(groupId)
    await loadGroups(boardId)
  }

  async function setGroupMembers(
    boardId: string,
    groupId: string,
    membershipIds: string[],
  ): Promise<void> {
    await groupRepository.setMembers(groupId, membershipIds)
    await loadGroups(boardId)
  }

  async function createBoard(name: string, accentHue: number): Promise<Board> {
    const board = await boardRepository.create(name, accentHue)
    boards.value = [...boards.value, board]
    return board
  }

  /** Edit board settings (owner-only by RLS); reflect the result locally. */
  async function updateBoard(boardId: string, patch: BoardPatch): Promise<void> {
    const updated = await boardRepository.update(boardId, patch)
    boards.value = boards.value.map((b) => (b.id === boardId ? updated : b))
  }

  /** Delete a board; it disappears from the list (memberships/items cascade). */
  async function deleteBoard(boardId: string): Promise<void> {
    await boardRepository.remove(boardId)
    boards.value = boards.value.filter((b) => b.id !== boardId)
  }

  function boardById(boardId: string): Board | undefined {
    return boards.value.find((b) => b.id === boardId)
  }

  function membersOf(boardId: string): Member[] {
    return membersByBoard.value[boardId] ?? []
  }

  function groupsOf(boardId: string): Group[] {
    return groupsByBoard.value[boardId] ?? []
  }

  return {
    boards,
    membersByBoard,
    groupsByBoard,
    loading,
    loadBoards,
    loadMembers,
    loadGroups,
    changeRole,
    removeMember,
    leaveBoard,
    createGroup,
    renameGroup,
    removeGroup,
    setGroupMembers,
    createBoard,
    updateBoard,
    deleteBoard,
    boardById,
    membersOf,
    groupsOf,
  }
})
