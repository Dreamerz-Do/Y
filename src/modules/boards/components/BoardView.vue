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
import {
  WEEKDAY_LABELS,
  monthMatrix,
  monthLabel,
  addMonth,
  addDays,
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
const { toggle: toggleTheme } = useTheme()

const activeTab = computed<BoardTab>(() => props.tab ?? 'today')
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

const todayKey = todayInZone()
const weekEnd = addDays(todayKey, 7)

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

const todayRows = computed(() => calendarRows.value.filter((r) => localDay(r.sortKey) === todayKey))
const weekRows = computed(() =>
  calendarRows.value.filter((r) => {
    const day = localDay(r.sortKey)
    return day > todayKey && day <= weekEnd
  }),
)

const todoRows = computed(() => {
  const todos = itemStore.itemsOf(props.boardId).filter((i) => !i.startsAt)
  return {
    open: todos.filter((i) => !i.isDone).map((i) => ({ view: toRowView(i, members.value), item: i })),
    done: todos.filter((i) => i.isDone).map((i) => ({ view: toRowView(i, members.value), item: i })),
  }
})

// --- Agenda: list or month (spec 7.6 #3) ---
const agendaView = ref<'list' | 'month'>('list')
const today = todayInZone()
const calYear = ref(Number(today.slice(0, 4)))
const calMonth = ref(Number(today.slice(5, 7)))
const selectedDay = ref(today)

const monthTitle = computed(() => monthLabel(calYear.value, calMonth.value))
const weekdayLabels = WEEKDAY_LABELS

const monthCells = computed(() =>
  monthMatrix(calYear.value, calMonth.value).map((cell) => {
    const rows = calendarRows.value.filter((r) => localDay(r.sortKey) === cell.iso)
    const dots = rows.slice(0, 3).map((r) => (r.color ? itemColorCss(r.color) : 'var(--color-text-faint)'))
    const [y, m, d] = cell.iso.split('-').map(Number)
    const count = rows.length
    return {
      ...cell,
      dots,
      isToday: cell.iso === todayKey,
      isSelected: cell.iso === selectedDay.value,
      label: `${d} ${monthLabel(y, m)}${count ? `, ${count} ${count === 1 ? 'item' : 'items'}` : ''}`,
    }
  }),
)

const selectedRows = computed(() => calendarRows.value.filter((r) => localDay(r.sortKey) === selectedDay.value))
const selectedDayLabel = computed(() => {
  if (selectedDay.value === todayKey) return 'Vandaag'
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${selectedDay.value}T12:00:00`),
  )
})

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
function selectDay(iso: string): void {
  selectedDay.value = iso
}

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

        <h2 class="mb-2.5 mt-6 text-label font-medium uppercase tracking-wide text-muted">Deze week</h2>
        <p v-if="!weekRows.length" class="py-1 text-body text-faint">Niets gepland.</p>
        <ItemRow v-for="r in weekRows" :key="r.key" :row="r" @open="openDetail" @busy="openDetail" />
      </template>

      <!-- Agenda -->
      <template v-else-if="activeTab === 'agenda'">
        <div class="mb-3 flex gap-2">
          <button
            type="button"
            class="h-touch flex-1 rounded-input border text-body2 font-medium"
            :class="agendaView === 'list' ? 'border-accent bg-accent text-accent-text' : 'border-border text-text'"
            :aria-pressed="agendaView === 'list'"
            @click="agendaView = 'list'"
          >
            Lijst
          </button>
          <button
            type="button"
            class="h-touch flex-1 rounded-input border text-body2 font-medium"
            :class="agendaView === 'month' ? 'border-accent bg-accent text-accent-text' : 'border-border text-text'"
            :aria-pressed="agendaView === 'month'"
            @click="agendaView = 'month'"
          >
            Maand
          </button>
        </div>

        <!-- Agenda: list -->
        <template v-if="agendaView === 'list'">
          <p v-if="!calendarRows.length" class="py-1 text-body text-faint">Nog geen agenda-items.</p>
          <ItemRow v-for="r in calendarRows" :key="r.key" :row="r" @open="openDetail" @busy="openDetail" />
        </template>

        <!-- Agenda: month -->
        <template v-else>
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
                cell.isSelected ? 'bg-accent text-accent-text' : cell.inMonth ? 'text-text' : 'text-faint',
                cell.isToday && !cell.isSelected ? 'ring-1 ring-accent' : '',
              ]"
              :aria-pressed="cell.isSelected"
              :aria-label="cell.label"
              @click="selectDay(cell.iso)"
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

          <h2 class="mb-2.5 mt-5 text-label font-medium uppercase tracking-wide text-muted">{{ selectedDayLabel }}</h2>
          <p v-if="!selectedRows.length" class="py-1 text-body text-faint">Niets op deze dag.</p>
          <ItemRow v-for="r in selectedRows" :key="r.key" :row="r" @open="openDetail" @busy="openDetail" />
        </template>
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
