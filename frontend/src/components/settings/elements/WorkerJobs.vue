<template>
  <div>
    <div class="d-flex justify-content-end mb-3">
      <button type="button" class="btn btn-outline-secondary" :disabled="loading" @click="loadJobs">
        <i class="bi bi-arrow-clockwise me-1"></i>{{ t('labels.refresh') }}
      </button>
    </div>

    <TableElement
      v-model:server-options="serverOptions"
      db-key="adminWorkerJobs"
      :rows-items="[25, 50, 100]"
      :rows-per-page="25"
      :server-items-length="meta.count"
      :loading="loading"
      :items="jobs"
      :headers="headers"
      :empty-message="t('labels.noWorkerJobs')"
      must-sort
      @expand-row="loadDetails">
      <template #header-id="header">
        <div class="filter-column">
          {{ t(header.text) }}
          <span class="clickable" @click="(event) => clickFilter('id', event)">
            <i v-if="showFilter.id" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.id" @click.stop>
            <input v-model="selectedId" type="text" class="form-control" @input="scheduleIdFilter" >
          </div>
        </div>
      </template>

      <template #header-name="header">
        <div class="filter-column">
          {{ t(header.text) }}
          <span class="clickable" @click="(event) => clickFilter('name', event)">
            <i v-if="showFilter.name" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.name" @click.stop>
            <select v-model="selectedName" class="form-select" @change="applyFilters">
              <option value="">{{ t('labels.all') }}</option>
              <option v-for="jobName in jobNames" :key="jobName" :value="jobName">{{ jobName }}</option>
            </select>
          </div>
        </div>
      </template>

      <template #header-state="header">
        <div class="filter-column">
          {{ t(header.text) }}
          <span class="clickable" @click="(event) => clickFilter('state', event)">
            <i v-if="showFilter.state" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.state" @click.stop>
            <select v-model="selectedState" class="form-select" @change="applyFilters">
              <option value="">{{ t('labels.all') }} ({{ totalCount }})</option>
              <option v-for="state in workerJobStates" :key="state" :value="state">
                {{ t(`workerJobStates.${state}`) }} ({{ counts[state] }})
              </option>
            </select>
          </div>
        </div>
      </template>

      <template #item-id="{ id }: WorkerJobSummary"><span :title="id">{{ id }}</span></template>
      <template #item-name="{ name }: WorkerJobSummary"><span class="fw-semibold">{{ name }}</span></template>
      <template #item-state="{ state }: WorkerJobSummary">
        <span class="badge" :class="stateBadge(state)">{{ t(`workerJobStates.${state}`) }}</span>
      </template>
      <template #item-timestamp="{ timestamp }: WorkerJobSummary">{{ formatDate(timestamp) }}</template>
      <template #item-duration="job: WorkerJobSummary">{{ formatDuration(job) }}</template>
      <template #item-attempts="job: WorkerJobSummary">{{ job.attemptsMade }} / {{ job.attempts }}</template>
      <template #item-buttons="job: WorkerJobSummary">
        <button
          v-if="job.state === 'failed'"
          type="button"
          class="btn btn-warning btn-sm"
          :disabled="retryingJobId === job.id"
          :title="t('labels.retry')"
          @click.stop="retryJob(job)">
          <i class="bi bi-arrow-repeat"></i>
        </button>
      </template>

      <template #expand="job: WorkerJobSummary">
        <div class="worker-job-details p-3">
          <div v-if="detailsLoadingJobIds.has(job.id)" class="text-body-secondary">{{ t('labels.loading') }}</div>
          <template v-else-if="detailsByJobId[job.id]">
            <dl class="row mb-3">
              <dt class="col-sm-3">{{ t('labels.processedOn') }}</dt>
              <dd class="col-sm-9">{{ formatOptionalDate(detailsByJobId[job.id]?.processedOn) }}</dd>
              <dt class="col-sm-3">{{ t('labels.finishedOn') }}</dt>
              <dd class="col-sm-9">{{ formatOptionalDate(detailsByJobId[job.id]?.finishedOn) }}</dd>
              <template v-if="detailsByJobId[job.id]?.failedReason">
                <dt class="col-sm-3">{{ t('labels.error') }}</dt>
                <dd class="col-sm-9 text-danger text-break">{{ detailsByJobId[job.id]?.failedReason }}</dd>
              </template>
            </dl>

            <h3 class="h6">{{ t('labels.payload') }}</h3>
            <pre>{{ formatValue(detailsByJobId[job.id]?.payload) }}</pre>
            <h3 class="h6">{{ t('labels.result') }}</h3>
            <pre>{{ detailsByJobId[job.id]?.result === null ? t('labels.noResult') : formatValue(detailsByJobId[job.id]?.result) }}</pre>
            <template v-if="detailsByJobId[job.id]?.stacktrace.length">
              <h3 class="h6">{{ t('labels.stacktrace') }}</h3>
              <pre>{{ detailsByJobId[job.id]?.stacktrace.join('\n') }}</pre>
            </template>
          </template>
        </div>
      </template>
    </TableElement>
  </div>
</template>

<script lang="ts" setup>
import {
  Meta,
  WorkerJobCounts,
  WorkerJobDetails,
  WorkerJobsResponse,
  WorkerJobState,
  WorkerJobSummary,
  workerJobStates
} from 'abrechnung-common/types.js'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header, Item, ServerOptions } from 'vue3-easy-data-table'
import API from '@/api.js'
import TableElement from '@/components/elements/TableElement.vue'

const { t, locale } = useI18n()
const headers: Header[] = [
  { text: 'labels.id', value: 'id' },
  { text: 'labels.job', value: 'name' },
  { text: 'labels.state', value: 'state' },
  { text: 'labels.createdAt', value: 'timestamp', sortable: true },
  { text: 'labels.duration', value: 'duration' },
  { text: 'labels.attempts', value: 'attempts' },
  { text: '', value: 'buttons', width: 60 }
]
const emptyCounts = () => Object.fromEntries(workerJobStates.map((state) => [state, 0])) as WorkerJobCounts
const jobs = ref<WorkerJobSummary[]>([])
const jobNames = ref<string[]>([])
const counts = ref(emptyCounts())
const meta = ref<Meta>({ count: 0, page: 1, limit: 25, countPages: 0 })
const selectedId = ref('')
const selectedName = ref('')
const selectedState = ref<WorkerJobState | ''>('')
const showFilter = ref({ id: false, name: false, state: false })
const serverOptions = ref<ServerOptions>({ page: 1, rowsPerPage: 25, sortBy: 'timestamp', sortType: 'desc' })
const loading = ref(false)
const detailsByJobId = ref<Record<string, WorkerJobDetails | undefined>>({})
const detailsLoadingJobIds = ref(new Set<string>())
const retryingJobId = ref<string>()
const loadedAt = ref(Date.now())
const totalCount = computed(() => Object.values(counts.value).reduce((sum, count) => sum + count, 0))
let loadRequestId = 0
let idFilterTimeout: ReturnType<typeof setTimeout> | undefined

async function loadJobs() {
  clearTimeout(idFilterTimeout)
  const requestId = ++loadRequestId
  loading.value = true
  detailsByJobId.value = {}
  detailsLoadingJobIds.value = new Set()
  const result = await API.getter<WorkerJobSummary[]>('admin/jobs', {
    ...(selectedId.value ? { id: selectedId.value } : {}),
    ...(selectedName.value ? { name: selectedName.value } : {}),
    ...(selectedState.value ? { state: selectedState.value } : {}),
    page: serverOptions.value.page,
    limit: serverOptions.value.rowsPerPage,
    sortDirection: serverOptions.value.sortType === 'asc' ? 'asc' : 'desc'
  })
  const response = result.ok as WorkerJobsResponse | undefined
  if (requestId !== loadRequestId) return
  if (response) {
    jobs.value = response.data
    jobNames.value = response.jobNames
    counts.value = response.counts
    meta.value = response.meta
    loadedAt.value = Date.now()
  }
  loading.value = false
}

async function loadDetails(_index: number, item: Item) {
  const job = item as WorkerJobSummary
  if (detailsByJobId.value[job.id] || detailsLoadingJobIds.value.has(job.id)) return

  detailsLoadingJobIds.value.add(job.id)
  const result = await API.getter<WorkerJobDetails>(`admin/jobs/${encodeURIComponent(job.id)}`)
  if (result.ok?.data) detailsByJobId.value[job.id] = result.ok.data
  detailsLoadingJobIds.value.delete(job.id)
}

async function retryJob(job: WorkerJobSummary) {
  if (!confirm(t('alerts.areYouSureRetryJob'))) return
  retryingJobId.value = job.id
  const result = await API.setter<WorkerJobSummary>(`admin/jobs/${encodeURIComponent(job.id)}/retry`, {})
  retryingJobId.value = undefined
  if (result.ok) await loadJobs()
}

function applyFilters() {
  if (serverOptions.value.page === 1) {
    void loadJobs()
  } else {
    serverOptions.value = { ...serverOptions.value, page: 1 }
  }
}

function scheduleIdFilter() {
  clearTimeout(idFilterTimeout)
  idFilterTimeout = setTimeout(applyFilters, 300)
}

function clickFilter(filter: keyof typeof showFilter.value, event: MouseEvent) {
  event.stopPropagation()
  if (!showFilter.value[filter]) {
    showFilter.value[filter] = true
    return
  }

  showFilter.value[filter] = false
  if (filter === 'id') {
    clearTimeout(idFilterTimeout)
    selectedId.value = ''
    applyFilters()
  } else if (filter === 'name' && selectedName.value) {
    selectedName.value = ''
    applyFilters()
  } else if (filter === 'state' && selectedState.value) {
    selectedState.value = ''
    applyFilters()
  }
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'medium' }).format(timestamp)
}

function formatOptionalDate(timestamp?: number) {
  return timestamp ? formatDate(timestamp) : '–'
}

function formatDuration(job: WorkerJobSummary) {
  if (!job.processedOn) return '–'
  const milliseconds = Math.max(0, (job.finishedOn ?? loadedAt.value) - job.processedOn)
  if (milliseconds < 1_000) return `${milliseconds} ms`
  if (milliseconds < 60_000) return `${(milliseconds / 1_000).toFixed(1)} s`
  return `${Math.floor(milliseconds / 60_000)} min ${Math.floor((milliseconds % 60_000) / 1_000)} s`
}

function formatValue(value: unknown) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2) ?? String(value)
}

function stateBadge(state: WorkerJobState) {
  return {
    waiting: 'text-bg-secondary',
    delayed: 'text-bg-info',
    active: 'text-bg-primary',
    completed: 'text-bg-success',
    failed: 'text-bg-danger'
  }[state]
}

onMounted(loadJobs)
onBeforeUnmount(() => clearTimeout(idFilterTimeout))
watch(serverOptions, loadJobs, { deep: true })
</script>

<style scoped>
.worker-job-details {
  background: var(--bs-tertiary-bg);
}

pre {
  max-height: 24rem;
  overflow: auto;
  padding: 0.75rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  background: var(--bs-body-bg);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
