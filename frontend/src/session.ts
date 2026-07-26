import type { AuthContext } from 'abrechnung-common/types.js'
import axios from 'axios'
import { readonly, ref } from 'vue'
import ENV from './env.js'
import {
  clearLogoutTombstone,
  hasLogoutTombstone,
  purgePrivateData,
  readAuthContext,
  setLogoutTombstone,
  storeAuthContext
} from './indexedDB.js'

const authContext = ref<AuthContext | null>(null)
const isOnline = ref(navigator.onLine)
const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('abrechnung-session')
const purgeHandlers = new Set<() => void | Promise<void>>()

async function purge(notify = true) {
  authContext.value = null
  await Promise.all([...purgeHandlers].map((handler) => handler()))
  await purgePrivateData()
  if (notify) channel?.postMessage('purge')
}

channel?.addEventListener('message', (event) => {
  if (event.data === 'purge') void purge(false)
})
navigator.serviceWorker?.addEventListener('message', (event) => {
  if (event.data === 'purge-private-data') void purge()
})
window.addEventListener('online', () => {
  isOnline.value = true
  void prepareLogin().catch(() => undefined)
})
window.addEventListener('offline', () => {
  isOnline.value = false
})

export async function initializeSession() {
  const stored = await readAuthContext()
  authContext.value = stored && Date.parse(stored.expiresAt) > Date.now() && !(await hasLogoutTombstone()) ? stored : null
  if (!authContext.value && stored) await purge()
  return authContext.value
}

export async function refreshAuthContext() {
  if (!navigator.onLine) return getValidOfflineContext()
  await prepareLogin()
  const response = await axios.get<AuthContext>(`${ENV.VITE_BACKEND_URL}/auth/authenticated`, { withCredentials: true })
  const previousScope = authContext.value?.cacheScope ?? (await readAuthContext())?.cacheScope
  if (previousScope && previousScope !== response.data.cacheScope) await purge()
  authContext.value = response.data
  await storeAuthContext(response.data)
  return response.data
}

export async function prepareLogin() {
  if (!navigator.onLine) return false
  if (!(await hasLogoutTombstone())) return true
  try {
    await axios.delete(`${ENV.VITE_BACKEND_URL}/auth/logout`, { withCredentials: true })
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error
  }
  await clearLogoutTombstone()
  return true
}

export async function getValidOfflineContext() {
  const context = authContext.value ?? (await initializeSession())
  if (!context || Date.parse(context.expiresAt) <= Date.now() || (await hasLogoutTombstone())) {
    await purge()
    return null
  }
  return context
}

export async function beginLogout() {
  await setLogoutTombstone()
  await purge()
}

export async function completeLogout() {
  await clearLogoutTombstone()
}

export function registerSessionPurgeHandler(handler: () => void | Promise<void>) {
  purgeHandlers.add(handler)
  return () => purgeHandlers.delete(handler)
}

export { purge as purgeSession }
export const sessionState = { authContext: readonly(authContext), isOnline: readonly(isOnline) }
