<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardStore } from '../composables/boardStore'
import { useSessionStore } from '@/stores/session'
import { useBoardAccent } from '@/shared/composables/useBoardAccent'
import { boardDotCss } from '@/shared/lib/palette'
import AppAvatar from '@/shared/ui/AppAvatar.vue'
import PendingInvitations from '@/modules/invitations/components/PendingInvitations.vue'
import BoardCreateSheet from './BoardCreateSheet.vue'

const boardStore = useBoardStore()
const session = useSessionStore()
const router = useRouter()
const { setHue } = useBoardAccent()

// The overview belongs to no single board, so the chrome returns to neutral.
setHue(null)

const createOpen = ref(false)

async function loadBoards(): Promise<void> {
  await boardStore.loadBoards()
  await Promise.all(boardStore.boards.map((b) => boardStore.loadMembers(b.id)))
}

onMounted(loadBoards)

const boards = computed(() => boardStore.boards)

function open(boardId: string): void {
  session.rememberBoard(boardId)
  void router.push({ name: 'board', params: { boardId, tab: 'today' } })
}

// Create a board and go straight into it. The creator becomes its first owner
// through the on_board_created trigger, so no extra membership call is needed.
async function createBoard(name: string, accentHue: number): Promise<void> {
  const board = await boardStore.createBoard(name, accentHue)
  createOpen.value = false
  open(board.id)
}
</script>

<template>
  <div class="relative flex min-h-dvh flex-col">
    <header class="flex h-14 items-center justify-between border-b border-border px-3">
      <h1 class="text-screen font-medium">Boards</h1>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="flex h-touch w-touch items-center justify-center rounded-full text-text"
          aria-label="Nieuw board"
          @click="createOpen = true"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button
          type="button"
          class="flex h-touch w-touch items-center justify-center rounded-full text-text"
          aria-label="Account"
          @click="router.push({ name: 'account' })"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
        </button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-4">
      <!-- Accepting an invitation adds a board, so refetch the list afterwards. -->
      <PendingInvitations @accepted="loadBoards" />

      <h2 class="mb-2.5 text-label font-medium uppercase tracking-wide text-muted">Jouw boards</h2>

      <div v-if="!boards.length" class="py-2">
        <p class="mb-4 text-body text-faint">Nog geen boards. Maak er een aan om te beginnen.</p>
        <button
          type="button"
          class="h-[52px] w-full rounded-card bg-accent text-lg font-medium text-accent-text"
          @click="createOpen = true"
        >
          Nieuw board
        </button>
      </div>

      <button
        v-for="board in boards"
        :key="board.id"
        type="button"
        class="mb-4 flex w-full flex-col gap-3.5 rounded-board border border-border bg-surface p-4 text-left"
        @click="open(board.id)"
      >
        <span class="flex items-center gap-2.5">
          <span
            class="h-2.5 w-2.5 rounded-full"
            :style="{ background: boardDotCss(board.accentHue) }"
            aria-hidden="true"
          ></span>
          <span class="text-title font-medium">{{ board.name }}</span>
        </span>
        <span class="flex gap-2">
          <AppAvatar
            v-for="m in boardStore.membersOf(board.id)"
            :key="m.membershipId"
            :initial="m.name.charAt(0)"
            :name="m.name"
            :hue="m.hue"
            :size="32"
          />
        </span>
      </button>
    </div>

    <BoardCreateSheet v-if="createOpen" @create="createBoard" @close="createOpen = false" />
  </div>
</template>
