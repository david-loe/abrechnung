import { type ActionCounts, actionAccesses } from 'abrechnung-common/types.js'
import { computed, readonly, ref } from 'vue'
import API from '@/api.js'
import { eventBus } from '@/eventBus.js'
import { registerSessionPurgeHandler, sessionState } from '@/session.js'

interface ApiMutationSucceededDetail {
  endpoint: string
  method: 'DELETE' | 'POST'
}

const counts = ref<ActionCounts | null>(null)
const total = computed(() => actionAccesses.reduce((sum, access) => sum + (counts.value?.[access] ?? 0), 0))
let inFlight: Promise<void> | undefined
let refreshQueued = false
let started = false
let generation = 0

const stateChangingPostEndpoints = [
  /^advance\/(appliedFor|received)$/,
  /^travel\/(appliedFor|approved|underExamination)$/,
  /^(expenseReport|healthCareCost)\/(inWork|underExamination)$/,
  /^approve\/(advance|travel)\/(approved|rejected|withdrawApproval)$/,
  /^examine\/(travel|expenseReport|healthCareCost)\/(approved|inWork|reviewCompleted|underExamination)$/,
  /^book\/(advance|travel|expenseReport|healthCareCost)\/booked$/
]
const stateChangingDeleteEndpoint =
  /^(advance|travel|expenseReport|healthCareCost|approve\/advance|examine\/(travel|expenseReport|healthCareCost))$/

function changesActionCounts({ endpoint, method }: ApiMutationSucceededDetail) {
  if (method === 'DELETE') return stateChangingDeleteEndpoint.test(endpoint)
  return stateChangingPostEndpoints.some((pattern) => pattern.test(endpoint))
}

export function refreshActionCounts(queueAfterInFlight = false) {
  if (!sessionState.isOnline.value || !sessionState.authContext.value) return Promise.resolve()
  if (inFlight) {
    refreshQueued ||= queueAfterInFlight
    return inFlight
  }

  const requestGeneration = generation
  inFlight = API.getter<ActionCounts>('user/actionCounts', {}, {}, { showAlert: false })
    .then((result) => {
      if (result.ok && requestGeneration === generation) counts.value = result.ok.data
    })
    .finally(() => {
      inFlight = undefined
      if (refreshQueued) {
        refreshQueued = false
        void refreshActionCounts()
      }
    })
  return inFlight
}

export function startActionCountUpdates() {
  if (started) return
  started = true

  window.addEventListener('focus', () => void refreshActionCounts())
  window.addEventListener('online', () => void refreshActionCounts())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshActionCounts()
  })
  eventBus.addEventListener('api-mutation-succeeded', (event) => {
    const detail = (event as CustomEvent<ApiMutationSucceededDetail>).detail
    if (changesActionCounts(detail)) void refreshActionCounts(true)
  })
}

registerSessionPurgeHandler(() => {
  generation += 1
  refreshQueued = false
  counts.value = null
})

export const actionCountState = { counts: readonly(counts), total: readonly(total) }
