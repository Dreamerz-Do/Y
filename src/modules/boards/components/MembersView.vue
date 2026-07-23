<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBoardStore } from '../composables/boardStore'
import { useInvitationStore } from '@/modules/invitations/composables/invitationStore'
import { useSessionStore } from '@/stores/session'
import { useBoardAccent } from '@/shared/composables/useBoardAccent'
import AppAvatar from '@/shared/ui/AppAvatar.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import InviteForm from '@/modules/invitations/components/InviteForm.vue'
import GroupCard from './GroupCard.vue'
import type { Member, Role } from '../types/board'

// Manage members and groups (spec 7.6 #7). Every management action is owner-only
// (spec 4.2); the RLS policies enforce that, this screen only exposes the
// controls when the viewer is an owner. A non-owner still sees the roster and
// may leave the board themselves (spec 4.5).
const props = defineProps<{ boardId: string }>()

const boardStore = useBoardStore()
const invitationStore = useInvitationStore()
const session = useSessionStore()
const router = useRouter()
const { setHue } = useBoardAccent()

const board = computed(() => boardStore.boardById(props.boardId))
const members = computed(() => boardStore.membersOf(props.boardId))
const groups = computed(() => boardStore.groupsOf(props.boardId))
const sentInvitations = computed(() =>
  invitationStore.invitationsOf(props.boardId).filter((i) => i.status === 'pending'),
)

const myMembership = computed(() =>
  members.value.find((m) => m.userId === session.user?.id),
)
const isOwner = computed(() => myMembership.value?.role === 'owner')

const roles: { value: Role; label: string }[] = [
  { value: 'owner', label: 'Eigenaar' },
  { value: 'member', label: 'Lid' },
  { value: 'guest', label: 'Gast' },
]

const newGroupName = ref('')
const actionError = ref('')

// A single pending confirmation. Naming what disappears is mandatory (spec 4.5).
const confirm = ref<{
  title: string
  message: string
  confirmLabel: string
  run: () => Promise<void>
} | null>(null)

onMounted(load)
watch(() => props.boardId, load)
watch(board, (b) => setHue(b?.accentHue ?? null), { immediate: true })

async function load(): Promise<void> {
  if (!boardStore.boards.length) await boardStore.loadBoards()
  await Promise.all([boardStore.loadMembers(props.boardId), boardStore.loadGroups(props.boardId)])
  if (isOwner.value) await invitationStore.loadForBoard(props.boardId)
}

async function guard(run: () => Promise<void>): Promise<void> {
  actionError.value = ''
  try {
    await run()
  } catch {
    // The last-owner guard and RLS both surface here; a neutral message keeps
    // "not allowed" and "not possible" indistinguishable (hard rule 5).
    actionError.value = 'Die actie kon niet worden uitgevoerd.'
  }
}

async function changeRole(membershipId: string, event: Event): Promise<void> {
  const role = (event.target as HTMLSelectElement).value as Role
  await guard(() => boardStore.changeRole(props.boardId, membershipId, role))
}

function askRemoveMember(member: Member): void {
  confirm.value = {
    title: `${member.name} verwijderen?`,
    message: `${member.name} verliest toegang tot dit board. Alle items die ${member.name} heeft aangemaakt worden permanent verwijderd; toewijzingen aan ${member.name} vervallen.`,
    confirmLabel: 'Verwijderen',
    run: () => boardStore.removeMember(props.boardId, member.membershipId),
  }
}

function askLeave(): void {
  const membershipId = myMembership.value?.membershipId
  if (!membershipId) return
  confirm.value = {
    title: 'Board verlaten?',
    message:
      'Je verliest toegang tot dit board. Alle items die je hebt aangemaakt worden permanent verwijderd; toewijzingen aan jou vervallen.',
    confirmLabel: 'Verlaten',
    run: async () => {
      await boardStore.leaveBoard(props.boardId, membershipId)
      await router.push({ name: 'boards' })
    },
  }
}

function askWithdraw(invitationId: string, email: string): void {
  confirm.value = {
    title: 'Uitnodiging intrekken?',
    message: `De openstaande uitnodiging voor ${email} wordt verwijderd.`,
    confirmLabel: 'Intrekken',
    run: () => invitationStore.withdraw(props.boardId, invitationId),
  }
}

function askRemoveGroup(groupId: string, name: string): void {
  confirm.value = {
    title: `Groep "${name}" verwijderen?`,
    message: `De groep "${name}" wordt verwijderd. Items die met deze groep zijn gedeeld, verliezen dit publiek — de items zelf blijven bestaan.`,
    confirmLabel: 'Verwijderen',
    run: () => boardStore.removeGroup(props.boardId, groupId),
  }
}

async function confirmAction(): Promise<void> {
  const action = confirm.value
  confirm.value = null
  if (action) await guard(action.run)
}

async function addGroup(): Promise<void> {
  const name = newGroupName.value.trim()
  if (!name) return
  await guard(() => boardStore.createGroup(props.boardId, name))
  newGroupName.value = ''
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
      <h1 class="flex-1 text-title font-medium">Leden &amp; groepen</h1>
    </header>

    <main class="flex-1 overflow-y-auto px-4 pb-10 pt-4">
      <p v-if="actionError" role="alert" class="mb-3 text-body2 text-danger">{{ actionError }}</p>

      <!-- Members -->
      <h2 class="mb-2.5 text-label font-medium uppercase tracking-wide text-muted">Leden</h2>
      <div
        v-for="m in members"
        :key="m.membershipId"
        class="mb-2.5 flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3"
      >
        <AppAvatar :initial="m.name.charAt(0)" :name="m.name" :hue="m.hue" :size="34" />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="text-body font-medium text-text">
            {{ m.name }}<span v-if="m.userId === session.user?.id" class="text-muted"> (jij)</span>
          </span>
        </span>

        <template v-if="isOwner && m.userId !== session.user?.id">
          <select
            class="h-touch rounded-input border border-border bg-bg px-2 text-body2 text-text"
            :value="m.role"
            :aria-label="`Rol van ${m.name}`"
            @change="changeRole(m.membershipId, $event)"
          >
            <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
          <button
            type="button"
            class="flex h-touch w-touch items-center justify-center text-danger"
            :aria-label="`${m.name} verwijderen`"
            @click="askRemoveMember(m)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></svg>
          </button>
        </template>
        <span v-else class="text-body2 text-muted">{{ roles.find((r) => r.value === m.role)?.label }}</span>
      </div>

      <!-- Invite (owner) -->
      <template v-if="isOwner">
        <h2 class="mb-2.5 mt-7 text-label font-medium uppercase tracking-wide text-muted">Uitnodigen</h2>
        <InviteForm :board-id="boardId" @invited="invitationStore.loadForBoard(boardId)" />

        <div v-if="sentInvitations.length" class="mt-4">
          <p class="mb-1.5 text-label font-medium text-muted">Openstaande uitnodigingen</p>
          <div
            v-for="inv in sentInvitations"
            :key="inv.id"
            class="mb-2 flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-2.5"
          >
            <span class="min-w-0 flex-1 truncate text-body2 text-text">{{ inv.email }}</span>
            <button
              type="button"
              class="h-touch text-body2 font-medium text-danger"
              @click="askWithdraw(inv.id, inv.email)"
            >
              Intrekken
            </button>
          </div>
        </div>
      </template>

      <!-- Groups -->
      <h2 class="mb-2.5 mt-7 text-label font-medium uppercase tracking-wide text-muted">Groepen</h2>
      <p v-if="!groups.length && !isOwner" class="py-1 text-body text-faint">Nog geen groepen.</p>

      <template v-if="isOwner">
        <GroupCard
          v-for="g in groups"
          :key="g.id"
          :group="g"
          :members="members"
          @rename="(name) => guard(() => boardStore.renameGroup(boardId, g.id, name))"
          @set-members="(ids) => guard(() => boardStore.setGroupMembers(boardId, g.id, ids))"
          @remove="askRemoveGroup(g.id, g.name)"
        />
        <form class="mt-1 flex items-center gap-2" @submit.prevent="addGroup">
          <input
            v-model="newGroupName"
            class="h-11 flex-1 rounded-input border border-border bg-surface px-3 text-body text-text"
            placeholder="Nieuwe groep…"
            aria-label="Naam van nieuwe groep"
          />
          <button
            type="submit"
            :disabled="!newGroupName.trim()"
            class="h-11 rounded-card bg-accent px-4 text-body2 font-medium text-accent-text disabled:opacity-50"
          >
            Toevoegen
          </button>
        </form>
      </template>
      <template v-else>
        <div
          v-for="g in groups"
          :key="g.id"
          class="mb-2 rounded-card border border-border bg-surface px-4 py-3"
        >
          <p class="text-body font-medium text-text">{{ g.name }}</p>
          <p class="text-meta text-muted">{{ g.memberIds.length }} leden</p>
        </div>
      </template>

      <!-- Leave -->
      <button
        v-if="myMembership"
        type="button"
        class="mt-8 h-12 w-full rounded-card border border-danger text-body font-medium text-danger"
        @click="askLeave"
      >
        Board verlaten
      </button>
    </main>

    <ConfirmDialog
      v-if="confirm"
      :title="confirm.title"
      :message="confirm.message"
      :confirm-label="confirm.confirmLabel"
      danger
      @confirm="confirmAction"
      @cancel="confirm = null"
    />
  </div>
</template>
