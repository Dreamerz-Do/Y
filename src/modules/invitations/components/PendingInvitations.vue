<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useInvitationStore } from '../composables/invitationStore'

// The invited user's own outstanding invitations, with accept/decline (spec
// 4.4). Accepting creates the membership through the accept_invitation RPC, so
// after it the boards list must be refetched — hence the 'accepted' event.
const emit = defineEmits<{ accepted: [] }>()

const store = useInvitationStore()
const invitations = computed(() => store.mine)

onMounted(() => store.loadMine())

async function accept(id: string): Promise<void> {
  await store.accept(id)
  emit('accepted')
}

function decline(id: string): Promise<void> {
  return store.decline(id)
}
</script>

<template>
  <section v-if="invitations.length" aria-label="Uitnodigingen" class="mb-6">
    <h2 class="mb-2.5 text-label font-medium uppercase tracking-wide text-muted">Uitnodigingen</h2>
    <div
      v-for="inv in invitations"
      :key="inv.id"
      class="mb-2.5 flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <p class="text-body text-text">
        Je bent uitgenodigd voor <span class="font-medium">{{ inv.boardName }}</span>.
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          class="h-touch flex-1 rounded-card bg-accent text-body font-medium text-accent-text"
          @click="accept(inv.id)"
        >
          Accepteren
        </button>
        <button
          type="button"
          class="h-touch flex-1 rounded-card border border-border text-body font-medium text-text"
          @click="decline(inv.id)"
        >
          Weigeren
        </button>
      </div>
    </div>
  </section>
</template>
