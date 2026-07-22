<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Group, Member } from '../types/board'

// One group's editor (spec 4.3): rename, toggle which members belong, delete.
// A group is an audience, not a permission level, so this only ever changes who
// is in it — never anyone's role.
const props = defineProps<{ group: Group; members: Member[] }>()

const emit = defineEmits<{
  rename: [name: string]
  remove: []
  setMembers: [membershipIds: string[]]
}>()

const name = ref(props.group.name)
const nameChanged = computed(() => name.value.trim() !== props.group.name && name.value.trim().length > 0)

function isMember(membershipId: string): boolean {
  return props.group.memberIds.includes(membershipId)
}

function toggle(membershipId: string): void {
  const next = isMember(membershipId)
    ? props.group.memberIds.filter((id) => id !== membershipId)
    : [...props.group.memberIds, membershipId]
  emit('setMembers', next)
}
</script>

<template>
  <div class="mb-2.5 rounded-card border border-border bg-surface p-4">
    <div class="flex items-center gap-2">
      <input
        v-model="name"
        class="h-11 flex-1 rounded-input border border-border bg-bg px-3 text-body font-medium text-text"
        :aria-label="`Naam van groep ${group.name}`"
      />
      <button
        v-if="nameChanged"
        type="button"
        class="h-11 rounded-card bg-accent px-3 text-body2 font-medium text-accent-text"
        @click="emit('rename', name.trim())"
      >
        Opslaan
      </button>
    </div>

    <p class="mb-1.5 mt-3 text-label font-medium text-muted">Leden</p>
    <label
      v-for="m in members"
      :key="m.membershipId"
      class="flex items-center gap-2.5 py-1"
    >
      <input
        type="checkbox"
        class="h-touch w-touch"
        :checked="isMember(m.membershipId)"
        :aria-label="m.name"
        @change="toggle(m.membershipId)"
      />
      <span class="text-body text-text">{{ m.name }}</span>
    </label>

    <button
      type="button"
      class="mt-3 h-touch text-body2 font-medium text-danger"
      @click="emit('remove')"
    >
      Groep verwijderen
    </button>
  </div>
</template>
