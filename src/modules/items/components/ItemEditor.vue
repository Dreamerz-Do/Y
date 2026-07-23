<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import type { Group, Member } from '@/modules/boards/types/board'
import { ITEM_COLORS, itemColorCss } from '@/shared/lib/palette'
import type { Visibility } from '../types/item'
import { type ItemForm, isSaveable } from '../composables/itemForm'

// The create/edit sheet (spec 7.6 #5 and #6). One form covers both a new item
// and an existing one; the parent maps the emitted form to the repository so no
// Supabase call lives in a component (spec 6.3). Everything but the title is
// optional (spec 3.5.1). Colour, visibility and assignment each pair with text
// or an icon — never colour alone (hard rule 6).
const props = defineProps<{
  mode: 'create' | 'edit'
  initialForm: ItemForm
  members: Member[]
  groups: Group[]
  saving?: boolean
}>()

const emit = defineEmits<{
  save: [form: ItemForm]
  remove: []
  close: []
}>()

const form = reactive<ItemForm>({ ...props.initialForm })

// Re-seed when the parent opens the sheet for a different item.
watch(
  () => props.initialForm,
  (next) => Object.assign(form, next),
)

const visibilities: { value: Visibility; label: string; hint: string }[] = [
  { value: 'board', label: 'Iedereen', hint: 'Zichtbaar voor het hele board' },
  { value: 'private', label: 'Alleen ik', hint: 'Niet zichtbaar voor anderen' },
  { value: 'shared_with', label: 'Selectie', hint: 'Specifieke leden of groepen' },
]

const saveable = computed(() => isSaveable(form))

function toggleMember(membershipId: string): void {
  const i = form.audienceMemberIds.indexOf(membershipId)
  if (i === -1) form.audienceMemberIds.push(membershipId)
  else form.audienceMemberIds.splice(i, 1)
}

function toggleGroup(groupId: string): void {
  const i = form.audienceGroupIds.indexOf(groupId)
  if (i === -1) form.audienceGroupIds.push(groupId)
  else form.audienceGroupIds.splice(i, 1)
}

function setColor(key: ItemForm['color']): void {
  form.color = form.color === key ? null : key
}
</script>

<template>
  <div class="absolute inset-0" :style="{ background: 'var(--color-overlay)' }" @click="emit('close')"></div>
  <div
    class="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-sheet bg-bg shadow-lg"
    role="dialog"
    :aria-label="mode === 'create' ? 'Nieuw item' : 'Item bewerken'"
  >
    <div class="mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-border" aria-hidden="true"></div>

    <div class="flex-1 overflow-y-auto px-5 pb-4 pt-3">
      <!-- Title -->
      <label class="flex flex-col gap-1.5">
        <span class="text-label font-medium text-muted">Titel</span>
        <input
          v-model="form.title"
          class="h-[52px] rounded-card border border-border bg-surface px-4 text-title text-text"
          placeholder="Wat moet er gebeuren?"
          aria-label="Titel van het item"
        />
      </label>

      <!-- Notes -->
      <label class="mt-4 flex flex-col gap-1.5">
        <span class="text-label font-medium text-muted">Notitie</span>
        <textarea
          v-model="form.notes"
          rows="2"
          class="rounded-card border border-border bg-surface px-4 py-3 text-body text-text"
          placeholder="Optioneel"
          aria-label="Notitie"
        ></textarea>
      </label>

      <!-- Date -->
      <div class="mt-4 flex items-center justify-between">
        <span class="text-label font-medium text-muted">Datum &amp; tijd</span>
        <button
          type="button"
          class="flex h-touch items-center rounded-full px-3 text-body2 font-medium"
          :class="form.hasDate ? 'bg-accent text-accent-text' : 'bg-surface2 text-muted'"
          :aria-pressed="form.hasDate"
          @click="form.hasDate = !form.hasDate"
        >
          {{ form.hasDate ? 'Met datum' : 'Zonder datum' }}
        </button>
      </div>

      <div v-if="form.hasDate" class="mt-2.5 flex flex-col gap-2.5">
        <label class="flex flex-col gap-1.5">
          <span class="sr-only">Datum</span>
          <input
            v-model="form.date"
            type="date"
            class="h-12 rounded-card border border-border bg-surface px-4 text-body text-text"
            aria-label="Datum"
          />
        </label>

        <label class="flex items-center gap-2">
          <input v-model="form.allDay" type="checkbox" class="h-touch w-touch" aria-label="Hele dag" />
          <span class="text-body text-text">Hele dag</span>
        </label>

        <div v-if="!form.allDay" class="flex items-center gap-2">
          <label class="flex flex-1 flex-col gap-1">
            <span class="text-meta text-muted">Van</span>
            <input
              v-model="form.startTime"
              type="time"
              class="h-12 rounded-card border border-border bg-surface px-4 text-body text-text"
              aria-label="Begintijd"
            />
          </label>
          <label class="flex flex-1 flex-col gap-1">
            <span class="text-meta text-muted">Tot</span>
            <input
              v-model="form.endTime"
              type="time"
              class="h-12 rounded-card border border-border bg-surface px-4 text-body text-text"
              aria-label="Eindtijd (optioneel)"
            />
          </label>
        </div>
      </div>

      <!-- Assignee -->
      <label class="mt-4 flex flex-col gap-1.5">
        <span class="text-label font-medium text-muted">Toegewezen aan</span>
        <select
          v-model="form.assigneeId"
          class="h-12 rounded-card border border-border bg-surface px-3 text-body text-text"
          aria-label="Toegewezen aan"
        >
          <option :value="null">Niemand</option>
          <option v-for="m in members" :key="m.membershipId" :value="m.membershipId">{{ m.name }}</option>
        </select>
      </label>

      <!-- Colour -->
      <fieldset class="mt-4">
        <legend class="mb-1.5 text-label font-medium text-muted">Kleur</legend>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="flex h-touch w-touch items-center justify-center rounded-full border-2"
            :class="form.color === null ? 'border-accent' : 'border-border'"
            :aria-pressed="form.color === null"
            aria-label="Geen kleur"
            @click="setColor(null)"
          >
            <span class="text-body2 text-muted">—</span>
          </button>
          <button
            v-for="c in ITEM_COLORS"
            :key="c.key"
            type="button"
            class="flex h-touch w-touch items-center justify-center rounded-full border-2"
            :class="form.color === c.key ? 'border-accent' : 'border-transparent'"
            :aria-pressed="form.color === c.key"
            :aria-label="c.key"
            :title="c.key"
            @click="setColor(c.key)"
          >
            <span
              class="flex h-6 w-6 items-center justify-center rounded-full text-white"
              :style="{ background: itemColorCss(c.key) }"
            >
              <svg v-if="form.color === c.key" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
          </button>
        </div>
      </fieldset>

      <!-- Visibility -->
      <fieldset class="mt-4">
        <legend class="mb-1.5 text-label font-medium text-muted">Zichtbaarheid</legend>
        <div class="flex flex-col gap-1.5">
          <label
            v-for="v in visibilities"
            :key="v.value"
            class="flex items-center gap-3 rounded-card border px-3.5 py-2.5"
            :class="form.visibility === v.value ? 'border-accent bg-surface2' : 'border-border'"
          >
            <input
              v-model="form.visibility"
              type="radio"
              :value="v.value"
              name="visibility"
              class="h-5 w-5"
            />
            <span class="flex flex-col">
              <span class="text-body font-medium text-text">{{ v.label }}</span>
              <span class="text-meta text-muted">{{ v.hint }}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <!-- Reveal owner: only meaningful for a private item that appears to others
           as a busy block (spec 3.2). -->
      <label v-if="form.visibility === 'private'" class="mt-3 flex items-center gap-2">
        <input v-model="form.revealOwner" type="checkbox" class="h-touch w-touch" aria-label="Toon mijn naam op het bezet-blok" />
        <span class="text-body2 text-text">Toon mijn naam op het bezet-blok</span>
      </label>

      <!-- Audience picker for shared_with -->
      <div v-if="form.visibility === 'shared_with'" class="mt-3">
        <p class="mb-1.5 text-label font-medium text-muted">Delen met</p>
        <div v-if="groups.length" class="mb-2 flex flex-col gap-1">
          <label v-for="g in groups" :key="g.id" class="flex items-center gap-2.5 py-1">
            <input
              type="checkbox"
              class="h-touch w-touch"
              :checked="form.audienceGroupIds.includes(g.id)"
              :aria-label="`Groep ${g.name}`"
              @change="toggleGroup(g.id)"
            />
            <span class="text-body text-text">{{ g.name }} <span class="text-meta text-muted">(groep)</span></span>
          </label>
        </div>
        <div class="flex flex-col gap-1">
          <label v-for="m in members" :key="m.membershipId" class="flex items-center gap-2.5 py-1">
            <input
              type="checkbox"
              class="h-touch w-touch"
              :checked="form.audienceMemberIds.includes(m.membershipId)"
              :aria-label="m.name"
              @change="toggleMember(m.membershipId)"
            />
            <span class="text-body text-text">{{ m.name }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex flex-col gap-2 border-t border-border px-5 pb-7 pt-3">
      <button
        type="button"
        class="h-[52px] rounded-card bg-accent text-lg font-medium text-accent-text disabled:opacity-50"
        :disabled="!saveable || saving"
        @click="emit('save', form)"
      >
        {{ saving ? 'Bezig…' : 'Opslaan' }}
      </button>
      <button
        v-if="mode === 'edit'"
        type="button"
        class="h-touch rounded-card text-body font-medium text-danger"
        @click="emit('remove')"
      >
        Verwijderen
      </button>
    </div>
  </div>
</template>
