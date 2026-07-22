import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useSessionStore } from '@/stores/session'

// boardId lives in the route (spec 6.5): deep links and notifications can point
// straight at a board, and every screen is explicitly board-scoped.
const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/modules/auth/components/LoginView.vue') },
  { path: '/signup', name: 'signup', component: () => import('@/modules/auth/components/SignUpView.vue') },
  { path: '/account', name: 'account', component: () => import('@/modules/auth/components/AccountView.vue') },
  { path: '/', name: 'boards', component: () => import('@/modules/boards/components/BoardsView.vue') },
  {
    path: '/b/:boardId/members',
    name: 'board-members',
    component: () => import('@/modules/boards/components/MembersView.vue'),
    props: true,
  },
  {
    path: '/b/:boardId/:tab(today|agenda|todos)?',
    name: 'board',
    component: () => import('@/modules/boards/components/BoardView.vue'),
    props: true,
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Login and sign-up are the only screens reachable without a session.
const PUBLIC_ROUTES = new Set(['login', 'signup'])

router.beforeEach((to) => {
  const session = useSessionStore()
  const isPublic = typeof to.name === 'string' && PUBLIC_ROUTES.has(to.name)
  if (!session.isAuthenticated && !isPublic) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (session.isAuthenticated && isPublic) {
    return { name: 'boards' }
  }
  return true
})
