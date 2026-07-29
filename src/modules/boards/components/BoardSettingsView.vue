<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardStore } from '../composables/boardStore'
import { useSessionStore } from '@/stores/session'
import { useBoardAccent } from '@/shared/composables/useBoardAccent'
import { BOARD_ACCENT_HUES, boardDotCss } from '@/shared/lib/palette'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import type { Board } from '../types/board'

// Board settings (spec 4.2: change board settings / delete board — owner only).
// The RLS policies enforce ownership; this screen only exposes the controls to
// an owner. A non-owner sees the board's name read-only.
const props = defineProps<{ boardId: string }>()

const boardStore = useBoardStore()
const session = useSessionStore()
const router = useRouter()
const { setHue } = useBoardAccent()

const board = computed(() => boardStore.boardById(props.boardId))
const members = computed(() => boardStore.membersOf(props.boardId))
const isOwner = computed(
  () => members.value.find((m) => m.userId === session.user?.id)?.role === 'owner',
)
// A board can only be deleted when no one else is left (spec 4.5); otherwise the
// owner leaves and hands over their items from Leden & groepen.
const otherMembers = computed(() => members.value.filter((m) => m.userId !== session.user?.id))
const canDelete = computed(() => isOwner.value && otherMembers.value.length === 0)

const visibilities: { value: Board['defaultVisibility']; label: string }[] = [
  { value: 'board', label: 'Iedereen' },
  { value: 'private', label: 'Alleen ik' },
]

const form = reactive<{ name: string; accentHue: number; defaultVisibility: Board['defaultVisibility'] }>({
  name: '',
  accentHue: BOARD_ACCENT_HUES[0],
  defaultVisibility: 'board',
})
const saving = ref(false)
const confirming = ref(false)
const actionError = ref('')

// Seed the form from the board once it is loaded, and preview the accent live.
watch(
  board,
  (b) => {
    if (!b) return
    form.name = b.name
    form.accentHue = b.accentHue
    form.defaultVisibility = b.defaultVisibility
    setHue(b.accentHue)
  },
  { immediate: true },
)

onMounted(load)
watch(() => props.boardId, load)

async function load(): Promise<void> {
  if (!boardStore.boards.length) await boardStore.loadBoards()
  await boardStore.loadMembers(props.boardId)
}

const dirty = computed(
  () =>
    !!board.value &&
    (form.name.trim() !== board.value.name ||
      form.accentHue !== board.value.accentHue ||
      form.defaultVisibility !== board.value.defaultVisibility),
)
const canSave = computed(() => isOwner.value && dirty.value && !!form.name.trim() && !saving.value)

function pickHue(hue: number): void {
  form.accentHue = hue
  setHue(hue) // live preview of the chrome
}

async function save(): Promise<void> {
  if (!canSave.value) return
  actionError.value = ''
  saving.value = true
  try {
    await boardStore.updateBoard(props.boardId, {
      name: form.name.trim(),
      accentHue: form.accentHue,
      defaultVisibility: form.defaultVisibility,
    })
    router.push({ name: 'board', params: { boardId: props.boardId, tab: 'kalender' } })
  } catch {
    actionError.value = 'Opslaan is niet gelukt.'
  } finally {
    saving.value = false
  }
}

async function remove(): Promise<void> {
  confirming.value = false
  actionError.value = ''
  saving.value = true
  try {
    await boardStore.deleteBoard(props.boardId)
    router.push({ name: 'boards' })
  } catch {
    actionError.value = 'Verwijderen is niet gelukt.'
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
        aria-label="Terug naar board"
        @click="router.push({ name: 'board', params: { boardId, tab: 'kalender' } })"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <h1 class="flex-1 text-title font-medium">Bordinstellingen</h1>
    </header>

    <main class="flex-1 overflow-y-auto px-4 pb-10 pt-4">
      <p v-if="actionError" role="alert" class="mb-3 text-body2 text-danger">{{ actionError }}</p>

      <!-- Non-owner: read-only -->
      <template v-if="!isOwner">
        <h2 class="mb-1.5 text-label font-medium uppercase tracking-wide text-muted">Naam</h2>
        <p class="mb-4 text-title text-text">{{ board?.name ?? '…' }}</p>
        <p class="text-body2 text-muted">Alleen eigenaren kunnen de instellingen wijzigen.</p>
      </template>

      <!-- Owner: editable -->
      <template v-else>
        <label class="flex flex-col gap-1.5">
          <span class="text-label font-medium text-muted">Naam</span>
          <input
            v-model="form.name"
            class="h-[52px] rounded-card border border-border bg-surface px-4 text-title text-text"
            placeholder="Naam van het board"
            aria-label="Naam van het board"
          />
        </label>

        <fieldset class="mt-4">
          <legend class="mb-1.5 text-label font-medium text-muted">Accentkleur</legend>
          <div class="flex flex-wrap gap-2.5">
            <button
              v-for="(hue, i) in BOARD_ACCENT_HUES"
              :key="hue"
              type="button"
              class="flex h-touch w-touch items-center justify-center rounded-full border-2"
              :class="form.accentHue === hue ? 'border-accent' : 'border-transparent'"
              :aria-pressed="form.accentHue === hue"
              :aria-label="`Accentkleur ${i + 1}`"
              @click="pickHue(hue)"
            >
              <span
                class="flex h-7 w-7 items-center justify-center rounded-full text-white"
                :style="{ background: boardDotCss(hue) }"
              >
                <svg v-if="form.accentHue === hue" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
            </button>
          </div>
        </fieldset>

        <fieldset class="mt-4">
          <legend class="mb-1.5 text-label font-medium text-muted">Standaard zichtbaarheid van nieuwe items</legend>
          <div class="flex gap-2">
            <button
              v-for="v in visibilities"
              :key="v.value"
              type="button"
              class="h-touch flex-1 rounded-input border text-body2 font-medium"
              :class="form.defaultVisibility === v.value ? 'border-accent bg-accent text-accent-text' : 'border-border text-text'"
              :aria-pressed="form.defaultVisibility === v.value"
              @click="form.defaultVisibility = v.value"
            >
              {{ v.label }}
            </button>
          </div>
        </fieldset>

        <button
          type="button"
          class="mt-6 h-[52px] w-full rounded-card bg-accent text-lg font-medium text-accent-text disabled:opacity-50"
          :disabled="!canSave"
          @click="save"
        >
          {{ saving ? 'Bezig…' : 'Opslaan' }}
        </button>

        <h2 class="mb-2.5 mt-10 text-label font-medium uppercase tracking-wide text-danger">Gevarenzone</h2>
        <button
          type="button"
          class="h-12 w-full rounded-card border border-danger text-body font-medium text-danger disabled:opacity-50"
          :disabled="saving || !canDelete"
          @click="confirming = true"
        >
          Board verwijderen
        </button>
        <p class="mt-2 text-meta text-muted">
          <template v-if="canDelete">
            Het board en alle items, groepen en uitnodigingen erin worden permanent verwijderd.
          </template>
          <template v-else>
            Je kunt een board alleen verwijderen als je het enige lid bent. Verlaat het board via Leden &amp; groepen om je items over te dragen.
          </template>
        </p>
      </template>
    </main>

    <ConfirmDialog
      v-if="confirming"
      :title="`${board?.name ?? 'Board'} verwijderen?`"
      message="Het board wordt met alle items, groepen, leden en uitnodigingen permanent verwijderd. Dit kan niet ongedaan worden gemaakt."
      confirm-label="Definitief verwijderen"
      danger
      @confirm="remove"
      @cancel="confirming = false"
    />
  </div>
</template>
