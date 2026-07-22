import { defineStore } from 'pinia'
import { ref } from 'vue'
import { boardRepository } from '../api/boardRepository'
import { groupRepository } from '../api/groupRepository'
import type { Board, Group, Member } from '../types/board'

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

  async function createBoard(name: string, accentHue: number): Promise<Board> {
    const board = await boardRepository.create(name, accentHue)
    boards.value = [...boards.value, board]
    return board
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
    createBoard,
    boardById,
    membersOf,
    groupsOf,
  }
})
