<script setup lang="ts">
// Bottom navigation with a central capture FAB (spec 7.7: quick capture is
// reachable from every board screen, one-handed, within thumb reach). Tabs are
// text + icon so the active state never rests on colour alone (hard rule 6).
export type BoardTab = 'kalender' | 'todos' | 'lijst'

defineProps<{
  active: BoardTab
}>()

const emit = defineEmits<{
  navigate: [tab: BoardTab]
  capture: []
}>()
</script>

<template>
  <nav class="relative h-24 shrink-0" aria-label="Board-navigatie">
    <div
      class="absolute inset-x-0 bottom-0 flex h-[76px] items-center gap-2 border-t border-border bg-bg px-2"
    >
      <button
        type="button"
        class="flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-meta font-medium"
        :class="active === 'kalender' ? 'text-accent' : 'text-muted'"
        :aria-current="active === 'kalender' ? 'page' : undefined"
        @click="emit('navigate', 'kalender')"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="3" x2="8" y2="7" />
          <line x1="16" y1="3" x2="16" y2="7" />
        </svg>
        <span>Kalender</span>
      </button>
      <button
        type="button"
        class="flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-meta font-medium"
        :class="active === 'todos' ? 'text-accent' : 'text-muted'"
        :aria-current="active === 'todos' ? 'page' : undefined"
        @click="emit('navigate', 'todos')"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M7 11l2 2 4-4" />
          <line x1="7" y1="16.5" x2="14" y2="16.5" />
        </svg>
        <span>To-do's</span>
      </button>

      <div class="w-[76px]" aria-hidden="true"></div>

      <button
        type="button"
        class="flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-meta font-medium"
        :class="active === 'lijst' ? 'text-accent' : 'text-muted'"
        :aria-current="active === 'lijst' ? 'page' : undefined"
        @click="emit('navigate', 'lijst')"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span>Lijst</span>
      </button>
    </div>

    <button
      type="button"
      class="absolute left-1/2 top-0 flex h-[60px] w-[60px] -translate-x-1/2 items-center justify-center rounded-full bg-accent text-white shadow-lg"
      aria-label="Nieuw item"
      @click="emit('capture')"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  </nav>
</template>
