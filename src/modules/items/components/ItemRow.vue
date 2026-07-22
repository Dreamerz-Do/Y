<script setup lang="ts">
import { computed } from 'vue'
import AppAvatar from '@/shared/ui/AppAvatar.vue'
import { itemColorCss } from '@/shared/lib/palette'
import type { ItemRowView } from '../types/item'

// Renders one item. Two shapes: a normal row, or a busy block — a private
// dated item owned by someone else, shown as time + optional owner and nothing
// more (spec 3.2 / 7.7). The block is a valid, complete state, not an error.
const props = defineProps<{
  row: ItemRowView
  showCheckbox?: boolean
}>()

const emit = defineEmits<{
  open: [row: ItemRowView]
  toggleDone: [row: ItemRowView]
  busy: [row: ItemRowView]
}>()

const barColor = computed(() => (props.row.color ? itemColorCss(props.row.color) : 'transparent'))

const metaText = computed(() => {
  const parts: string[] = []
  if (props.row.timeLabel) parts.push(props.row.timeLabel)
  if (props.row.recurring) parts.push(props.row.recurring)
  return parts.join(' · ')
})

// A spoken label for the busy block: "Bezet, 14:00 tot 15:30" (spec 7.8).
const busyLabel = computed(() => {
  const time = props.row.timeLabel ? props.row.timeLabel.replace('–', ' tot ') : ''
  const owner = props.row.ownerName ? `, ${props.row.ownerName}` : ''
  return `Bezet${owner}${time ? `, ${time}` : ''}`
})

const badgeLabel = computed(() =>
  props.row.badge === 'lock' ? 'Privé' : props.row.badge === 'subset' ? 'Gedeeld met selectie' : '',
)
</script>

<template>
  <!-- Busy block -->
  <button
    v-if="row.isBusy"
    type="button"
    class="mb-2.5 flex w-full items-center gap-3 rounded-card border border-dashed border-border bg-surface2 px-4 py-3.5 text-left text-text"
    :aria-label="busyLabel"
    @click="emit('busy', row)"
  >
    <svg
      class="shrink-0 opacity-60"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="text-body2 font-medium opacity-90">{{ row.timeLabel }}</span>
      <span class="text-label opacity-65">Bezet<template v-if="row.ownerName"> — {{ row.ownerName }}</template></span>
    </span>
  </button>

  <!-- Normal row -->
  <div
    v-else
    class="mb-2.5 flex items-start gap-3 rounded-card border border-border bg-surface px-4 py-3.5 pl-3.5"
    :style="{ borderLeft: `4px solid ${barColor}`, opacity: row.done ? 0.55 : 1 }"
  >
    <button
      v-if="showCheckbox"
      type="button"
      class="mt-px flex h-touch w-touch shrink-0 items-center justify-center text-text"
      :aria-pressed="row.done"
      :aria-label="row.done ? `${row.title}, gedaan` : `${row.title}, markeer als gedaan`"
      @click.stop="emit('toggleDone', row)"
    >
      <span
        class="flex h-[22px] w-[22px] items-center justify-center rounded-badge border-[1.5px] border-current text-body2"
        :style="{ opacity: row.done ? 1 : 0.4 }"
        aria-hidden="true"
      >{{ row.done ? '✓' : '' }}</span>
    </button>

    <button
      type="button"
      class="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
      @click="emit('open', row)"
    >
      <span class="flex items-center gap-1.5">
        <span
          class="text-body font-medium"
          :style="{ textDecoration: row.done ? 'line-through' : 'none' }"
        >{{ row.title }}</span>
        <span v-if="row.badge" class="flex opacity-60" :title="badgeLabel">
          <span class="sr-only">{{ badgeLabel }}</span>
          <svg
            v-if="row.badge === 'lock'"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="8" cy="9" r="3" />
            <circle cx="16" cy="10" r="2.3" />
            <path d="M3 20c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6" />
          </svg>
        </span>
      </span>
      <span v-if="metaText" class="text-label opacity-65">{{ metaText }}</span>
    </button>

    <div v-if="row.assignees.length" class="-ml-1 flex">
      <AppAvatar
        v-for="(av, i) in row.assignees"
        :key="i"
        :initial="av.initial"
        :hue="av.hue"
        :size="26"
      />
    </div>
  </div>
</template>
