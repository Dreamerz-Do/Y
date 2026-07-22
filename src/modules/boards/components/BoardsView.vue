<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardStore } from '../composables/boardStore'
import { useSessionStore } from '@/stores/session'
import { useBoardAccent } from '@/shared/composables/useBoardAccent'
import { boardDotCss } from '@/shared/lib/palette'
import AppAvatar from '@/shared/ui/AppAvatar.vue'

const boardStore = useBoardStore()
const session = useSessionStore()
const router = useRouter()
const { setHue } = useBoardAccent()

// The overview belongs to no single board, so the chrome returns to neutral.
setHue(null)

onMounted(async () => {
  await boardStore.loadBoards()
  await Promise.all(boardStore.boards.map((b) => boardStore.loadMembers(b.id)))
})

const boards = computed(() => boardStore.boards)

function open(boardId: string): void {
  session.rememberBoard(boardId)
  void router.push({ name: 'board', params: { boardId, tab: 'today' } })
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex h-14 items-center justify-between border-b border-border px-3">
      <h1 class="text-screen font-medium">Boards</h1>
    </header>

    <div class="flex-1 overflow-y-auto p-4">
      <h2 class="mb-2.5 text-label font-medium uppercase tracking-wide text-muted">Jouw boards</h2>

      <p v-if="!boards.length" class="py-2 text-body text-faint">
        Nog geen boards. Maak er een aan om te beginnen.
      </p>

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
  </div>
</template>
