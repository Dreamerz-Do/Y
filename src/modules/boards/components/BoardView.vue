<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardStore } from '../composables/boardStore'
import { useItemStore } from '@/modules/items/composables/itemStore'
import { useSessionStore } from '@/stores/session'
import { useBoardAccent } from '@/shared/composables/useBoardAccent'
import { toRowView, busyBlockToRowView } from '@/modules/items/composables/itemView'
import {
  type ItemForm,
  emptyForm,
  itemToForm,
  formToNewItem,
  formToPatch,
  formToAudience,
} from '@/modules/items/composables/itemForm'
import {
  WEEKDAY_LABELS,
  monthMatrix,
  monthLabel,
  addMonth,
  localDay,
} from '@/modules/items/composables/agendaMonth'
import { todayInZone } from '@/modules/items/composables/itemDateTime'
import { itemColorCss } from '@/shared/lib/palette'
import type { Item, ItemRowView } from '@/modules/items/types/item'
import ItemRow from '@/modules/items/components/ItemRow.vue'
import ItemEditor from '@/modules/items/components/ItemEditor.vue'
import ItemCaptureSheet from '@/modules/items/components/ItemCaptureSheet.vue'
import BottomNav, { type BoardTab } from '@/shared/ui/BottomNav.vue'

const props = defineProps<{ boardId: string; tab?: BoardTab }>()

const boardStore = useBoardStore()
const itemStore = useItemStore()
const session = useSessionStore()
const router = useRouter()
const { setHue } = useBoardAccent()

const activeTab = computed<BoardTab>(() => props.tab ?? 'kalender')
const board = computed(() => boardStore.boardById(props.boardId))

const captureOpen = ref(false)
const saving = ref(false)

// The full editor, distinct from the quick capture: it opens only for an
// existing item (creation happens inline in the capture sheet).
const editorOpen = ref(false)
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
const isOwner = computed(
  () => members.value.find((m) => m.userId === session.user?.id)?.role === 'owner',
)

const todayKey = todayInZone()

// Dated visible items and content-free busy blocks, merged. Busy blocks come
// from a separate projection so no private content is ever present (spec 3.2).
const calendarRows = computed<(ItemRowView & { sortKey: string; key: string })[]>(() => {
  const dated = itemStore
    .itemsOf(props.boardId)
    .filter((i) => i.startsAt)
    .map((i) => ({ ...toRowView(i, members.value), sortKey: i.startsAt as string, key: i.id }))
  const busy = itemStore
    .busyOf(props.boardId)
    .map((b) => ({ ...busyBlockToRowView(b), sortKey: b.startsAt, key: `busy-${b.id}` }))
  return [...dated, ...busy]
})

// --- Kalender: a month calendar; tapping a day with items opens a sheet ---
const today = todayInZone()
const calYear = ref(Number(today.slice(0, 4)))
const calMonth = ref(Number(today.slice(5, 7)))
const monthTitle = computed(() => monthLabel(calYear.value, calMonth.value))
const weekdayLabels = WEEKDAY_LABELS

const monthCells = computed(() =>
  monthMatrix(calYear.value, calMonth.value).map((cell) => {
    const rows = calendarRows.value.filter((r) => localDay(r.sortKey) === cell.iso)
    const dots = rows.slice(0, 3).map((r) => (r.color ? itemColorCss(r.color) : 'var(--color-text-faint)'))
    const [y, m, d] = cell.iso.split('-').map(Number)
    return {
      ...cell,
      dots,
      hasItems: rows.length > 0,
      isToday: cell.iso === todayKey,
      label: `${d} ${monthLabel(y, m)}${rows.length ? `, ${rows.length} ${rows.length === 1 ? 'item' : 'items'}` : ''}`,
    }
  }),
)

function prevMonth(): void {
  const p = addMonth(calYear.value, calMonth.value, -1)
  calYear.value = p.year
  calMonth.value = p.month
}
function nextMonth(): void {
  const n = addMonth(calYear.value, calMonth.value, 1)
  calYear.value = n.year
  calMonth.value = n.month
}

// The day sheet: the dated items on a tapped day.
const daySheetIso = ref<string | null>(null)
const daySheetRows = computed(() =>
  daySheetIso.value ? calendarRows.value.filter((r) => localDay(r.sortKey) === daySheetIso.value) : [],
)
const daySheetLabel = computed(() => {
  const iso = daySheetIso.value
  if (!iso) return ''
  if (iso === todayKey) return 'Vandaag'
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${iso}T12:00:00`),
  )
})
function openDay(iso: string): void {
  if (calendarRows.value.some((r) => localDay(r.sortKey) === iso)) daySheetIso.value = iso
}

// --- To-do's: the dateless items ---
const todoRows = computed(() => {
  const todos = itemStore.itemsOf(props.boardId).filter((i) => !i.startsAt)
  return {
    open: todos.filter((i) => !i.isDone).map((i) => ({ view: toRowView(i, members.value), item: i })),
    done: todos.filter((i) => i.isDone).map((i) => ({ view: toRowView(i, members.value), item: i })),
  }
})

// --- Lijst: every item, calendar or to-do, newest first. Dated items sort by
// their date; dateless to-dos by when they were added (spec: newest on top). ---
const listRows = computed(() => {
  const items = itemStore.itemsOf(props.boardId).map((i) => ({
    ...toRowView(i, members.value),
    sortTs: i.startsAt ?? i.createdAt,
    key: i.id,
  }))
  const busy = itemStore.busyOf(props.boardId).map((b) => ({
    ...busyBlockToRowView(b),
    sortTs: b.startsAt,
    key: `busy-${b.id}`,
  }))
  return [...items, ...busy].sort((a, b) => b.sortTs.localeCompare(a.sortTs))
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
  editingId.value = item.id
  captureOpen.value = false
  daySheetIso.value = null
  editorOpen.value = true
}

function closeEditor(): void {
  editorOpen.value = false
  editingId.value = null
}

async function saveEditor(form: ItemForm): Promise<void> {
  if (!editingId.value) return
  saving.value = true
  try {
    await itemStore.update(props.boardId, editingId.value, formToPatch(form), formToAudience(form))
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

// Quick capture: title is enough; date, assignee, colour and visibility are
// optional and picked inline in the same sheet (spec 3.5.1 / 7.7).
async function saveCapture(form: ItemForm): Promise<void> {
  saving.value = true
  try {
    await itemStore.add(formToNewItem(form, props.boardId), formToAudience(form))
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
        aria-label="Leden en groepen"
        @click="router.push({ name: 'board-members', params: { boardId: props.boardId } })"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      </button>
      <button
        v-if="isOwner"
        type="button"
        class="flex h-touch w-touch items-center justify-center rounded-full"
        aria-label="Bordinstellingen"
        @click="router.push({ name: 'board-settings', params: { boardId: props.boardId } })"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
      </button>
      <button
        type="button"
        class="flex h-touch w-touch items-center justify-center rounded-full"
        aria-label="Synchroniseren"
        @click="load"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v5h-5" /></svg>
      </button>
    </header>

    <main class="flex-1 overflow-y-auto px-4 pb-36 pt-4">
      <!-- Kalender -->
      <template v-if="activeTab === 'kalender'">
        <div class="mb-3 flex items-center justify-between">
          <button
            type="button"
            class="flex h-touch w-touch items-center justify-center rounded-full text-text"
            aria-label="Vorige maand"
            @click="prevMonth"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span class="text-body font-medium capitalize">{{ monthTitle }}</span>
          <button
            type="button"
            class="flex h-touch w-touch items-center justify-center rounded-full text-text"
            aria-label="Volgende maand"
            @click="nextMonth"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>

        <div class="mb-1 grid grid-cols-7" aria-hidden="true">
          <div v-for="w in weekdayLabels" :key="w" class="py-1.5 text-center text-meta font-medium text-faint">{{ w }}</div>
        </div>

        <div class="grid grid-cols-7 gap-0.5" role="grid" aria-label="Kalender">
          <button
            v-for="cell in monthCells"
            :key="cell.iso"
            type="button"
            class="flex min-h-[46px] flex-col items-center gap-1 rounded-card py-1.5"
            :class="[
              cell.inMonth ? 'text-text' : 'text-faint',
              cell.isToday ? 'ring-1 ring-accent' : '',
            ]"
            :aria-label="cell.label"
            @click="openDay(cell.iso)"
          >
            <span class="text-body2">{{ cell.day }}</span>
            <span class="flex min-h-[6px] gap-0.5">
              <span
                v-for="(dot, i) in cell.dots"
                :key="i"
                class="h-1.5 w-1.5 rounded-full"
                :style="{ background: dot }"
                aria-hidden="true"
              ></span>
            </span>
          </button>
        </div>
      </template>

      <!-- To-do's -->
      <template v-else-if="activeTab === 'todos'">
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

      <!-- Lijst: all items, newest first -->
      <template v-else>
        <h2 class="mb-2.5 text-label font-medium uppercase tracking-wide text-muted">Alle items</h2>
        <p v-if="!listRows.length" class="py-1 text-body text-faint">Nog geen items.</p>
        <ItemRow v-for="r in listRows" :key="r.key" :row="r" @open="openDetail" @busy="openDetail" />
      </template>
    </main>

    <BottomNav :active="activeTab" @navigate="goTo" @capture="captureOpen = true" />

    <!-- Day sheet: the items on a tapped calendar day -->
    <template v-if="daySheetIso">
      <div class="absolute inset-0" :style="{ background: 'var(--color-overlay)' }" @click="daySheetIso = null"></div>
      <div
        class="absolute inset-x-0 bottom-0 flex max-h-[70dvh] flex-col rounded-t-sheet bg-bg px-5 pb-7 pt-3 shadow-lg"
        role="dialog"
        :aria-label="daySheetLabel"
      >
        <div class="mx-auto mb-2 h-1 w-9 shrink-0 rounded-full bg-border" aria-hidden="true"></div>
        <h2 class="mb-2.5 text-title font-medium capitalize text-text">{{ daySheetLabel }}</h2>
        <div class="overflow-y-auto">
          <ItemRow v-for="r in daySheetRows" :key="r.key" :row="r" @open="openDetail" @busy="openDetail" />
        </div>
      </div>
    </template>

    <!-- Quick capture sheet -->
    <ItemCaptureSheet
      v-if="captureOpen"
      :members="members"
      :groups="groups"
      :default-visibility="board?.defaultVisibility"
      :saving="saving"
      @save="saveCapture"
      @close="captureOpen = false"
    />

    <!-- Full edit sheet -->
    <ItemEditor
      v-if="editorOpen"
      mode="edit"
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
