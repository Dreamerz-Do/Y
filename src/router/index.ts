import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useSessionStore } from '@/stores/session'

// boardId lives in the route (spec 6.5): deep links and notifications can point
// straight at a board, and every screen is explicitly board-scoped.
const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/modules/auth/components/LoginView.vue') },
  { path: '/', name: 'boards', component: () => import('@/modules/boards/components/BoardsView.vue') },
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

router.beforeEach((to) => {
  const session = useSessionStore()
  if (!session.isAuthenticated && to.name !== 'login') {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (session.isAuthenticated && to.name === 'login') {
    return { name: 'boards' }
  }
  return true
})
