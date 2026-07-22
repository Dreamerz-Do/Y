import { defineStore } from 'pinia'
import { ref } from 'vue'
import { boardRepository } from '../api/boardRepository'
import type { Board, Member } from '../types/board'

// Server-data store for the boards domain (spec 6.4). Fed only by the
// repository layer; components never call Supabase themselves.
export const useBoardStore = defineStore('boards', () => {
  const boards = ref<Board[]>([])
  const membersByBoard = ref<Record<string, Member[]>>({})
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

  return {
    boards,
    membersByBoard,
    loading,
    loadBoards,
    loadMembers,
    createBoard,
    boardById,
    membersOf,
  }
})
