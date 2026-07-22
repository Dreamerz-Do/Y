<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardStore } from '../composables/boardStore'
import { useItemStore } from '@/modules/items/composables/itemStore'
import { useSessionStore } from '@/stores/session'
import { useBoardAccent } from '@/shared/composables/useBoardAccent'
import { useTheme } from '@/shared/composables/useTheme'
import { toRowView, busyBlockToRowView } from '@/modules/items/composables/itemView'
import {
  type ItemForm,
  emptyForm,
  itemToForm,
  formToNewItem,
  formToPatch,
  formToAudience,
} from '@/modules/items/composables/itemForm'
import type { Item, ItemRowView } from '@/modules/items/types/item'
import ItemRow from '@/modules/items/components/ItemRow.vue'
import ItemEditor from '@/modules/items/components/ItemEditor.vue'
import BottomNav, { type BoardTab } from '@/shared/ui/BottomNav.vue'

const props = defineProps<{ boardId: string; tab?: BoardTab }>()

const boardStore = useBoardStore()
const itemStore = useItemStore()
const session = useSessionStore()
const router = useRouter()
const { setHue } = useBoardAccent()
const { toggle: toggleTheme } = useTheme()

const activeTab = computed<BoardTab>(() => props.tab ?? 'today')
const board = computed(() => boardStore.boardById(props.boardId))

const captureOpen = ref(false)
const captureText = ref('')
const saving = ref(false)

// The full create/edit sheet, distinct from the one-field quick capture.
const editorOpen = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editorForm = ref<ItemForm>(emptyForm())
const editingId = ref<string | null>(null)

onMounted(load)
watch(() => props.boardId, load)
watch(board, (b) => setHue(b?.accentHue ?? null), { immediate: true })

async function load(): Promise<void> {
  session.rememberBoard(props.boardId)
  if (!boardStore.boards.length) await boardStore.loadBoards()
  await Promise.all([
    boardStore.loadMembers(props.boardId),
    boardStore.loadGroups(props.boardId),
    itemStore.load(props.boardId),
  ])
}

const members = computed(() => boardStore.membersOf(props.boardId))
const groups = computed(() => boardStore.groupsOf(props.boardId))

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}
const todayKey = new Date().toISOString().slice(0, 10)

// Calendar rows: dated visible items and content-free busy blocks, merged and
// sorted by start time. Busy blocks come from a separate projection so no
// private content is ever present here (spec 3.2).
const calendarRows = computed<(ItemRowView & { sortKey: string; key: string })[]>(() => {
  const dated = itemStore
    .itemsOf(props.boardId)
    .filter((i) => i.startsAt)
    .map((i) => ({ ...toRowView(i, members.value), sortKey: i.startsAt as string, key: i.id }))
  const busy = itemStore
    .busyOf(props.boardId)
    .map((b) => ({ ...busyBlockToRowView(b), sortKey: b.startsAt, key: `busy-${b.id}` }))
  return [...dated, ...busy].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
})

const todayRows = computed(() => calendarRows.value.filter((r) => dayKey(r.sortKey) === todayKey))
const upcomingRows = computed(() => calendarRows.value.filter((r) => dayKey(r.sortKey) > todayKey))

const todoRows = computed(() => {
  const todos = itemStore.itemsOf(props.boardId).filter((i) => !i.startsAt)
  return {
    open: todos.filter((i) => !i.isDone).map((i) => ({ view: toRowView(i, members.value), item: i })),
    done: todos.filter((i) => i.isDone).map((i) => ({ view: toRowView(i, members.value), item: i })),
  }
})

function goTo(tab: BoardTab): void {
  void router.push({ name: 'board', params: { boardId: props.boardId, tab } })
}

// Open the full editor for an existing item. Busy blocks are someone else's
// private items and carry no editable content, so they are ignored here.
async function openDetail(row: ItemRowView): Promise<void> {
  const item = itemStore.itemsOf(props.boardId).find((i) => i.id === row.id)
  if (!item) return
  const audience = item.visibility === 'shared_with' ? await itemStore.shares(item.id) : undefined
  editorForm.value = itemToForm(item, audience)
  editorMode.value = 'edit'
  editingId.value = item.id
  captureOpen.value = false
  editorOpen.value = true
}

// Escalate a quick capture into the full editor, carrying the typed title.
function openFullCreate(): void {
  const form = emptyForm(board.value?.defaultVisibility)
  form.title = captureText.value.trim()
  editorForm.value = form
  editorMode.value = 'create'
  editingId.value = null
  captureOpen.value = false
  editorOpen.value = true
}

function closeEditor(): void {
  editorOpen.value = false
  editingId.value = null
}

async function saveEditor(form: ItemForm): Promise<void> {
  saving.value = true
  try {
    if (editorMode.value === 'create') {
      await itemStore.add(formToNewItem(form, props.boardId), formToAudience(form))
    } else if (editingId.value) {
      await itemStore.update(props.boardId, editingId.value, formToPatch(form), formToAudience(form))
    }
    closeEditor()
  } finally {
    saving.value = false
  }
}

async function removeEditor(): Promise<void> {
  if (!editingId.value) return
  saving.value = true
  try {
    await itemStore.remove(props.boardId, editingId.value)
    closeEditor()
  } finally {
    saving.value = false
  }
}

async function toggleDone(item: Item): Promise<void> {
  await itemStore.toggleDone(props.boardId, item.id, !item.isDone)
}

async function saveCapture(): Promise<void> {
  const title = captureText.value.trim()
  if (!title) return
  saving.value = true
  try {
    // Quick capture: title only, visibility falls back to the board default
    // (spec 3.5.1). Everything else is optional and added later.
    await itemStore.add({ boardId: props.boardId, title, visibility: board.value?.defaultVisibility })
    captureText.value = ''
    captureOpen.value = false
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-dvh flex-col">
    <header class="flex h-14 items-center gap-1 bg-accent px-2 text-accent-text">
      <button
        type="button"
        class="flex h-touch w-touch items-center justify-center rounded-full"
        aria-label="Terug naar boards"
        @click="router.push({ name: 'boards' })"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <h1 class="flex-1 text-title font-medium">{{ board?.name ?? '…' }}</h1>
      <button
        type="button"
        class="flex h-touch w-touch items-center justify-center rounded-full"
        aria-label="Synchroniseren"
        @click="load"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v5h-5" /></svg>
      </button>
      <button
        type="button"
        class="flex h-touch w-touch items-center justify-center rounded-full"
        aria-label="Licht of donker thema wisselen"
        @click="toggleTheme"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>
      </button>
    </header>

    <main class="flex-1 overflow-y-auto px-4 pb-36 pt-4">
      <!-- Today -->
      <template v-if="activeTab === 'today'">
        <h2 class="mb-2.5 text-label font-medium uppercase tracking-wide text-muted">Vandaag</h2>
        <p v-if="!todayRows.length" class="py-1 text-body text-faint">Niets voor vandaag.</p>
        <ItemRow v-for="r in todayRows" :key="r.key" :row="r" @open="openDetail" @busy="openDetail" />

        <h2 class="mb-2.5 mt-6 text-label font-medium uppercase tracking-wide text-muted">Binnenkort</h2>
        <p v-if="!upcomingRows.length" class="py-1 text-body text-faint">Niets gepland.</p>
        <ItemRow v-for="r in upcomingRows" :key="r.key" :row="r" @open="openDetail" @busy="openDetail" />
      </template>

      <!-- Agenda -->
      <template v-else-if="activeTab === 'agenda'">
        <h2 class="mb-2.5 text-label font-medium uppercase tracking-wide text-muted">Agenda</h2>
        <p v-if="!calendarRows.length" class="py-1 text-body text-faint">Nog geen agenda-items.</p>
        <ItemRow v-for="r in calendarRows" :key="r.key" :row="r" @open="openDetail" @busy="openDetail" />
      </template>

      <!-- To-dos -->
      <template v-else>
        <h2 class="mb-2.5 text-label font-medium uppercase tracking-wide text-muted">Te doen</h2>
        <p v-if="!todoRows.open.length" class="py-1 text-body text-faint">Alles gedaan.</p>
        <ItemRow
          v-for="entry in todoRows.open"
          :key="entry.item.id"
          :row="entry.view"
          show-checkbox
          @open="openDetail"
          @toggle-done="toggleDone(entry.item)"
        />
        <template v-if="todoRows.done.length">
          <h2 class="mb-2.5 mt-6 text-label font-medium uppercase tracking-wide text-muted">Klaar</h2>
          <ItemRow
            v-for="entry in todoRows.done"
            :key="entry.item.id"
            :row="entry.view"
            show-checkbox
            @open="openDetail"
            @toggle-done="toggleDone(entry.item)"
          />
        </template>
      </template>
    </main>

    <BottomNav :active="activeTab" @navigate="goTo" @capture="captureOpen = true" />

    <!-- Quick capture sheet -->
    <div v-if="captureOpen" class="absolute inset-0" :style="{ background: 'var(--color-overlay)' }" @click="captureOpen = false"></div>
    <div
      v-if="captureOpen"
      class="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 rounded-t-sheet bg-bg px-5 pb-7 pt-3 shadow-lg"
      role="dialog"
      aria-label="Nieuw item"
    >
      <div class="mx-auto h-1 w-9 rounded-full bg-border" aria-hidden="true"></div>
      <input
        v-model="captureText"
        class="h-[52px] rounded-card border border-border bg-surface px-4 text-title text-text"
        placeholder="Nieuw item…"
        aria-label="Titel van het item"
        @keyup.enter="saveCapture"
      />
      <button
        type="button"
        class="h-[52px] rounded-card bg-accent text-lg font-medium text-accent-text disabled:opacity-50"
        :disabled="!captureText.trim() || saving"
        @click="saveCapture"
      >
        {{ saving ? 'Bezig…' : 'Opslaan' }}
      </button>
      <button
        type="button"
        class="h-touch text-body2 font-medium text-accent"
        @click="openFullCreate"
      >
        Meer opties — datum, kleur, zichtbaarheid
      </button>
    </div>

    <!-- Full create/edit sheet -->
    <ItemEditor
      v-if="editorOpen"
      :mode="editorMode"
      :initial-form="editorForm"
      :members="members"
      :groups="groups"
      :saving="saving"
      @save="saveEditor"
      @remove="removeEditor"
      @close="closeEditor"
    />
  </div>
</template>
