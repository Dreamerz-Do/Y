<script setup lang="ts">
import { ref } from 'vue'
import { useInvitationStore } from '../composables/invitationStore'
import type { Role } from '@/modules/boards/types/board'

// Invite an existing account by email (spec 4.4). Owner-only; RLS and the
// create_invitation RPC enforce that, this form only collects input. An email
// address is personal data, so it is never logged (hard rule 4).
const props = defineProps<{ boardId: string }>()
const emit = defineEmits<{ invited: [] }>()

const store = useInvitationStore()

const email = ref('')
const role = ref<Role>('member')
const busy = ref(false)
const error = ref('')
const done = ref(false)

const roles: { value: Role; label: string }[] = [
  { value: 'member', label: 'Lid' },
  { value: 'guest', label: 'Gast' },
  { value: 'owner', label: 'Eigenaar' },
]

async function submit(): Promise<void> {
  error.value = ''
  done.value = false
  busy.value = true
  try {
    await store.invite(props.boardId, email.value.trim(), role.value)
    email.value = ''
    done.value = true
    emit('invited')
  } catch {
    // The invite fails clearly when no account owns the address (spec 4.4).
    // We do not echo the address back into any log.
    error.value = 'Uitnodigen mislukt. Bestaat er een account voor dit e-mailadres?'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="flex flex-col gap-2.5" @submit.prevent="submit">
    <label class="flex flex-col gap-1.5">
      <span class="text-label font-medium text-muted">E-mailadres</span>
      <input
        v-model="email"
        type="email"
        autocomplete="off"
        required
        class="h-12 rounded-card border border-border bg-surface px-3.5 text-body text-text"
        placeholder="naam@voorbeeld.nl"
        aria-label="E-mailadres om uit te nodigen"
      />
    </label>

    <label class="flex flex-col gap-1.5">
      <span class="text-label font-medium text-muted">Rol</span>
      <select
        v-model="role"
        class="h-12 rounded-card border border-border bg-surface px-3 text-body text-text"
        aria-label="Rol"
      >
        <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
      </select>
    </label>

    <p v-if="error" role="alert" class="text-body2 text-danger">{{ error }}</p>
    <p v-if="done" role="status" class="text-body2 text-muted">Uitnodiging verstuurd.</p>

    <button
      type="submit"
      :disabled="busy || !email.trim()"
      class="h-12 rounded-card bg-accent text-body font-medium text-accent-text disabled:opacity-50"
    >
      {{ busy ? 'Bezig…' : 'Uitnodigen' }}
    </button>
  </form>
</template>
