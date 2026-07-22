import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  itemRepository,
  type ItemPatch,
  type NewItem,
  type ShareTargets,
} from '../api/itemRepository'
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

  // The audience is only meaningful for shared_with items; for every other
  // visibility we still clear shares so no stale rows linger (spec 3.2).
  const EMPTY_AUDIENCE: ShareTargets = { memberIds: [], groupIds: [] }

  async function add(input: NewItem, audience: ShareTargets = EMPTY_AUDIENCE): Promise<void> {
    const item = await itemRepository.create(input)
    if (input.visibility === 'shared_with') {
      await itemRepository.replaceShares(item.id, audience)
    }
    await load(input.boardId)
  }

  async function update(
    boardId: string,
    itemId: string,
    patch: ItemPatch,
    audience: ShareTargets = EMPTY_AUDIENCE,
  ): Promise<void> {
    await itemRepository.update(itemId, patch)
    // When an item is (or stays) shared_with, its audience is rewritten; when it
    // moves to board/private the shares are cleared so they cannot leak later.
    if (patch.visibility !== undefined) {
      await itemRepository.replaceShares(
        itemId,
        patch.visibility === 'shared_with' ? audience : EMPTY_AUDIENCE,
      )
    }
    await load(boardId)
  }

  async function remove(boardId: string, itemId: string): Promise<void> {
    await itemRepository.remove(itemId)
    await load(boardId)
  }

  function shares(itemId: string): Promise<ShareTargets> {
    return itemRepository.sharesByItem(itemId)
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

  return {
    itemsByBoard,
    busyByBoard,
    loading,
    load,
    add,
    update,
    remove,
    shares,
    toggleDone,
    itemsOf,
    busyOf,
  }
})
