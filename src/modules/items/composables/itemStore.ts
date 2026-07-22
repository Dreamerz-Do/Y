import { defineStore } from 'pinia'
import { ref } from 'vue'
import { itemRepository, type NewItem } from '../api/itemRepository'
import type { BusyBlock, Item } from '../types/item'

// Server-data store for the items domain (spec 6.4). Items and busy blocks are
// kept per board so switching boards never mixes data across the board
// boundary (hard rule 1).
export const useItemStore = defineStore('items', () => {
  const itemsByBoard = ref<Record<string, Item[]>>({})
  const busyByBoard = ref<Record<string, BusyBlock[]>>({})
  const loading = ref(false)

  async function load(boardId: string): Promise<void> {
    loading.value = true
    try {
      const [items, busy] = await Promise.all([
        itemRepository.listByBoard(boardId),
        itemRepository.busyBlocksByBoard(boardId),
      ])
      itemsByBoard.value = { ...itemsByBoard.value, [boardId]: items }
      busyByBoard.value = { ...busyByBoard.value, [boardId]: busy }
    } finally {
      loading.value = false
    }
  }

  async function add(input: NewItem): Promise<void> {
    await itemRepository.create(input)
    await load(input.boardId)
  }

  async function toggleDone(boardId: string, itemId: string, isDone: boolean): Promise<void> {
    await itemRepository.setDone(itemId, isDone)
    await load(boardId)
  }

  function itemsOf(boardId: string): Item[] {
    return itemsByBoard.value[boardId] ?? []
  }

  function busyOf(boardId: string): BusyBlock[] {
    return busyByBoard.value[boardId] ?? []
  }

  return { itemsByBoard, busyByBoard, loading, load, add, toggleDone, itemsOf, busyOf }
})
