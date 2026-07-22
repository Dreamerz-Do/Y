<script setup lang="ts">
// A confirmation that names what disappears and how much — never a generic
// "are you sure?" (spec 4.5). Deletion here is permanent and touches other
// people's data, so the message is explicit and the confirm action is styled
// as destructive with a text label, not colour alone (hard rule 6).
defineProps<{
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <div class="absolute inset-0" :style="{ background: 'var(--color-overlay)' }" @click="emit('cancel')"></div>
  <div
    class="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-board bg-bg p-5 shadow-lg"
    role="alertdialog"
    :aria-label="title"
  >
    <h2 class="text-title font-medium text-text">{{ title }}</h2>
    <p class="mt-2 text-body text-muted">{{ message }}</p>
    <div class="mt-5 flex flex-col gap-2">
      <button
        type="button"
        class="h-12 rounded-card text-body font-medium"
        :class="danger ? 'bg-danger text-white' : 'bg-accent text-accent-text'"
        @click="emit('confirm')"
      >
        {{ confirmLabel ?? 'Bevestigen' }}
      </button>
      <button
        type="button"
        class="h-12 rounded-card border border-border text-body font-medium text-text"
        @click="emit('cancel')"
      >
        Annuleren
      </button>
    </div>
  </div>
</template>
