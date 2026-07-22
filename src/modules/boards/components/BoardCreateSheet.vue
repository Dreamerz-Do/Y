<script setup lang="ts">
import { ref } from 'vue'
import { BOARD_ACCENT_HUES, boardDotCss } from '@/shared/lib/palette'

// Create a board (spec 2 #2, 7.6 #1). A board is identified by its name; the
// accent hue is chrome only (spec 7.3) and never the sole carrier of meaning
// (hard rule 6) — the name is always the identifier, the colour is decoration.
const emit = defineEmits<{
  create: [name: string, accentHue: number]
  close: []
}>()

const name = ref('')
const accentHue = ref<number>(BOARD_ACCENT_HUES[0])
const saving = ref(false)

async function submit(): Promise<void> {
  const trimmed = name.value.trim()
  if (!trimmed || saving.value) return
  saving.value = true
  // The parent performs the create and closes the sheet; keep saving true so a
  // second tap cannot fire a duplicate while the request is in flight.
  emit('create', trimmed, accentHue.value)
}
</script>

<template>
  <div class="absolute inset-0" :style="{ background: 'var(--color-overlay)' }" @click="emit('close')"></div>
  <div
    class="absolute inset-x-0 bottom-0 flex flex-col gap-4 rounded-t-sheet bg-bg px-5 pb-7 pt-3 shadow-lg"
    role="dialog"
    aria-label="Nieuw board"
  >
    <div class="mx-auto h-1 w-9 rounded-full bg-border" aria-hidden="true"></div>

    <label class="flex flex-col gap-1.5">
      <span class="text-label font-medium text-muted">Naam</span>
      <input
        v-model="name"
        class="h-[52px] rounded-card border border-border bg-surface px-4 text-title text-text"
        placeholder="Bijv. Huishouden"
        aria-label="Naam van het board"
        @keyup.enter="submit"
      />
    </label>

    <fieldset>
      <legend class="mb-1.5 text-label font-medium text-muted">Accentkleur</legend>
      <div class="flex flex-wrap gap-2.5">
        <button
          v-for="(hue, i) in BOARD_ACCENT_HUES"
          :key="hue"
          type="button"
          class="flex h-touch w-touch items-center justify-center rounded-full border-2"
          :class="accentHue === hue ? 'border-accent' : 'border-transparent'"
          :aria-pressed="accentHue === hue"
          :aria-label="`Accentkleur ${i + 1}`"
          @click="accentHue = hue"
        >
          <span
            class="flex h-7 w-7 items-center justify-center rounded-full text-white"
            :style="{ background: boardDotCss(hue) }"
          >
            <svg v-if="accentHue === hue" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        </button>
      </div>
    </fieldset>

    <button
      type="button"
      class="h-[52px] rounded-card bg-accent text-lg font-medium text-accent-text disabled:opacity-50"
      :disabled="!name.trim() || saving"
      @click="submit"
    >
      {{ saving ? 'Bezig…' : 'Board aanmaken' }}
    </button>
  </div>
</template>
