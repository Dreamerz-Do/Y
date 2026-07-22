import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from '@/router'
import { useSessionStore } from '@/stores/session'
import './main.css'

async function bootstrap(): Promise<void> {
  const app = createApp(App)
  app.use(createPinia())

  // Resolve the session before the first navigation so the auth guard has a
  // real answer instead of redirecting a signed-in user to /login on reload.
  const session = useSessionStore()
  await session.init()

  app.use(router)
  app.mount('#app')
}

void bootstrap()
