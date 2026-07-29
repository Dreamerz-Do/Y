<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import type { Group, Member } from '@/modules/boards/types/board'
import { ITEM_COLORS, itemColorCss, memberColorCss } from '@/shared/lib/palette'
import type { Visibility } from '../types/item'
import { type ItemForm, emptyForm, isSaveable } from '../composables/itemForm'
import { todayInZone } from '../composables/itemDateTime'

// Quick capture (spec 7.7 / 7.6 #5): one field to add an item in seconds, with
// the optional details — date, assignee, colour, visibility — folded away
// behind "Details toevoegen" and revealed inline, in the same sheet. This is
// distinct from the full editor (ItemEditor), which opens only for an existing
// item. Everything but the title is optional (spec 3.5.1); colour and
// visibility always carry text, never colour alone (hard rule 6).
const props = withDefaults(
  defineProps<{
    members: Member[]
    groups: Group[]
    defaultVisibility?: Visibility
    saving?: boolean
    // A guest may only assign to themselves (spec 4.2); owners/members: everyone.
    canAssignOthers?: boolean
    myMembershipId?: string | null
  }>(),
  { defaultVisibility: 'board', canAssignOthers: true, myMembershipId: null },
)

const emit = defineEmits<{
  save: [form: ItemForm]
  close: []
}>()

const form = reactive<ItemForm>(emptyForm(props.defaultVisibility ?? 'board'))
const expanded = ref(false)

const saveable = computed(() => isSaveable(form))
const assignableMembers = computed(() =>
  props.canAssignOthers
    ? props.members
    : props.members.filter((m) => m.membershipId === props.myMembershipId),
)

const visibilities: { value: Visibility; label: string }[] = [
  { value: 'board', label: 'Iedereen' },
  { value: 'private', label: 'Alleen ik' },
  { value: 'shared_with', label: 'Selectie' },
]

// A quick-captured dated item is all-day; a precise time is added later in the
// full editor. So the date chips only ever toggle an all-day date.
const today = todayInZone()
const isToday = computed(() => form.hasDate && form.allDay && form.date === today)

function setNoDate(): void {
  form.hasDate = false
}
function setToday(): void {
  form.hasDate = true
  form.allDay = true
  form.date = today
}
function setDate(value: string): void {
  if (!value) {
    setNoDate()
    return
  }
  form.hasDate = true
  form.allDay = true
  form.date = value
}

function setAssignee(membershipId: string): void {
  form.assigneeId = form.assigneeId === membershipId ? null : membershipId
}

function setColor(key: ItemForm['color']): void {
  form.color = form.color === key ? null : key
}

function toggleGroup(groupId: string): void {
  const i = form.audienceGroupIds.indexOf(groupId)
  if (i === -1) form.audienceGroupIds.push(groupId)
  else form.audienceGroupIds.splice(i, 1)
}

function toggleMember(membershipId: string): void {
  const i = form.audienceMemberIds.indexOf(membershipId)
  if (i === -1) form.audienceMemberIds.push(membershipId)
  else form.audienceMemberIds.splice(i, 1)
}

// Dropping out of "Selectie" clears a half-picked audience so it can't linger.
watch(
  () => form.visibility,
  (v) => {
    if (v !== 'shared_with') {
      form.audienceMemberIds = []
      form.audienceGroupIds = []
    }
  },
)

function save(): void {
  if (saveable.value) emit('save', form)
}
</script>

<template>
  <div class="absolute inset-0" :style="{ background: 'var(--color-overlay)' }" @click="emit('close')"></div>
  <div
    class="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col gap-3.5 overflow-y-auto rounded-t-sheet bg-bg px-5 pb-7 pt-3 shadow-lg"
    role="dialog"
    aria-label="Nieuw item"
  >
    <div class="mx-auto h-1 w-9 shrink-0 rounded-full bg-border" aria-hidden="true"></div>

    <input
      v-model="form.title"
      class="h-[52px] rounded-card border border-border bg-surface px-4 text-title text-text"
      placeholder="Nieuw item…"
      aria-label="Titel van het item"
      @keyup.enter="save"
    />

    <button
      v-if="!expanded"
      type="button"
      class="h-touch text-left text-body2 font-medium text-accent"
      @click="expanded = true"
    >
      + Details toevoegen
    </button>

    <template v-else>
      <!-- Date -->
      <div>
        <p class="mb-1.5 text-label font-medium text-muted">Datum</p>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="flex h-touch items-center rounded-full border px-4 text-body2 font-medium"
            :class="!form.hasDate ? 'border-accent bg-accent text-accent-text' : 'border-border text-text'"
            :aria-pressed="!form.hasDate"
            @click="setNoDate"
          >
            Geen
          </button>
          <button
            type="button"
            class="flex h-touch items-center rounded-full border px-4 text-body2 font-medium"
            :class="isToday ? 'border-accent bg-accent text-accent-text' : 'border-border text-text'"
            :aria-pressed="isToday"
            @click="setToday"
          >
            Vandaag
          </button>
          <input
            type="date"
            class="h-touch flex-1 rounded-full border border-border bg-transparent px-3 text-body2 text-text"
            :value="form.hasDate ? form.date : ''"
            aria-label="Kies een datum"
            @change="setDate(($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <!-- Assignee -->
      <div v-if="assignableMembers.length">
        <p class="mb-1.5 text-label font-medium text-muted">Toewijzen</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="m in assignableMembers"
            :key="m.membershipId"
            type="button"
            class="flex h-touch w-touch items-center justify-center rounded-full border-2 text-body font-medium text-white"
            :class="form.assigneeId === m.membershipId ? 'border-accent' : 'border-transparent'"
            :style="{ background: memberColorCss(m.hue) }"
            :aria-pressed="form.assigneeId === m.membershipId"
            :aria-label="`Toewijzen aan ${m.name}`"
            @click="setAssignee(m.membershipId)"
          >
            {{ m.name.charAt(0).toUpperCase() }}
          </button>
        </div>
      </div>

      <!-- Colour -->
      <fieldset>
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
      <fieldset>
        <legend class="mb-1.5 text-label font-medium text-muted">Zichtbaar voor</legend>
        <div class="flex gap-2">
          <button
            v-for="v in visibilities"
            :key="v.value"
            type="button"
            class="h-touch flex-1 rounded-input border text-body2 font-medium"
            :class="form.visibility === v.value ? 'border-accent bg-accent text-accent-text' : 'border-border text-text'"
            :aria-pressed="form.visibility === v.value"
            @click="form.visibility = v.value"
          >
            {{ v.label }}
          </button>
        </div>

        <div v-if="form.visibility === 'shared_with'" class="mt-2.5 flex flex-col gap-1">
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
      </fieldset>
    </template>

    <button
      type="button"
      class="h-[52px] shrink-0 rounded-card bg-accent text-lg font-medium text-accent-text disabled:opacity-50"
      :disabled="!saveable || saving"
      @click="save"
    >
      {{ saving ? 'Bezig…' : 'Opslaan' }}
    </button>
  </div>
</template>
