<template>
  <div>
    <div class="d-flex flex-wrap align-items-end gap-3 mb-3">
      <div>
        <label for="worker-job-state" class="form-label">{{ t('labels.state') }}</label>
        <select id="worker-job-state" v-model="selectedState" class="form-select" @change="changeState">
          <option value="">{{ t('labels.all') }} ({{ totalCount }})</option>
          <option v-for="state in workerJobStates" :key="state" :value="state">
            {{ t(`workerJobStates.${state}`) }} ({{ counts[state] }})
          </option>
        </select>
      </div>
      <div>
        <label for="worker-job-page-size" class="form-label">{{ t('labels.entriesPerPage') }}</label>
        <select id="worker-job-page-size" v-model.number="limit" class="form-select" @change="changePageSize">
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>
      <button type="button" class="btn btn-outline-secondary" :disabled="loading" @click="loadJobs">
        <i class="bi bi-arrow-clockwise me-1"></i>{{ t('labels.refresh') }}
      </button>
    </div>

    <div class="table-responsive border rounded">
      <table class="table table-striped table-hover align-middle mb-0">
        <thead>
          <tr>
            <th>{{ t('labels.job') }}</th>
            <th>{{ t('labels.state') }}</th>
            <th>{{ t('labels.createdAt') }}</th>
            <th>{{ t('labels.duration') }}</th>
            <th>{{ t('labels.attempts') }}</th>
            <th class="text-end">{{ t('labels.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="job in jobs" :key="job.id">
            <tr>
              <td>
                <div class="fw-semibold">{{ job.name }}</div>
                <small class="text-body-secondary">{{ job.id }}</small>
              </td>
              <td><span class="badge" :class="stateBadge(job.state)">{{ t(`workerJobStates.${job.state}`) }}</span></td>
              <td>{{ formatDate(job.timestamp) }}</td>
              <td>{{ formatDuration(job) }}</td>
              <td>{{ job.attemptsMade }} / {{ job.attempts }}</td>
              <td class="text-end text-nowrap">
                <button type="button" class="btn btn-light btn-sm" :title="t('labels.details')" @click="toggleDetails(job)">
                  <i class="bi" :class="expandedJobId === job.id ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
                </button>
                <button
                  v-if="job.state === 'failed'"
                  type="button"
                  class="btn btn-warning btn-sm ms-2"
                  :disabled="retryingJobId === job.id"
                  :title="t('labels.retry')"
                  @click="retryJob(job)">
                  <i class="bi bi-arrow-repeat"></i>
                </button>
              </td>
            </tr>
            <tr v-if="expandedJobId === job.id">
              <td colspan="6" class="worker-job-details p-3">
                <div v-if="detailsLoading" class="text-body-secondary">{{ t('labels.loading') }}</div>
                <template v-else-if="details">
                  <dl class="row mb-3">
                    <dt class="col-sm-3">{{ t('labels.processedOn') }}</dt>
                    <dd class="col-sm-9">{{ formatOptionalDate(details.processedOn) }}</dd>
                    <dt class="col-sm-3">{{ t('labels.finishedOn') }}</dt>
                    <dd class="col-sm-9">{{ formatOptionalDate(details.finishedOn) }}</dd>
                    <template v-if="details.failedReason">
                      <dt class="col-sm-3">{{ t('labels.error') }}</dt>
                      <dd class="col-sm-9 text-danger text-break">{{ details.failedReason }}</dd>
                    </template>
                  </dl>

                  <h3 class="h6">{{ t('labels.payload') }}</h3>
                  <pre>{{ formatValue(details.payload) }}</pre>
                  <h3 class="h6">{{ t('labels.result') }}</h3>
                  <pre>{{ details.result === null ? t('labels.noResult') : formatValue(details.result) }}</pre>
                  <template v-if="details.stacktrace.length">
                    <h3 class="h6">{{ t('labels.stacktrace') }}</h3>
                    <pre>{{ details.stacktrace.join('\n') }}</pre>
                  </template>
                </template>
              </td>
            </tr>
          </template>
          <tr v-if="!loading && jobs.length === 0">
            <td colspan="6" class="text-center text-body-secondary py-4">{{ t('labels.noWorkerJobs') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="d-flex align-items-center justify-content-between mt-3">
      <span class="text-body-secondary">{{ t('labels.pageXOfY', { X: page, Y: Math.max(meta.countPages, 1) }) }}</span>
      <div class="btn-group">
        <button type="button" class="btn btn-outline-secondary" :disabled="page <= 1 || loading" @click="goToPage(page - 1)">
          <i class="bi bi-chevron-left"></i>
        </button>
        <button
          type="button"
          class="btn btn-outline-secondary"
          :disabled="page >= meta.countPages || loading"
          @click="goToPage(page + 1)">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {
  GETResponse,
  Meta,
  WorkerJobCounts,
  WorkerJobDetails,
  WorkerJobState,
  WorkerJobSummary,
  workerJobStates
} from 'abrechnung-common/types.js'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'

type WorkerJobsResponse = GETResponse<WorkerJobSummary[]> & { counts: WorkerJobCounts }

const { t, locale } = useI18n()
const emptyCounts = () => Object.fromEntries(workerJobStates.map((state) => [state, 0])) as WorkerJobCounts
const jobs = ref<WorkerJobSummary[]>([])
const counts = ref(emptyCounts())
const meta = ref<Meta>({ count: 0, page: 1, limit: 25, countPages: 0 })
const selectedState = ref<WorkerJobState | ''>('')
const page = ref(1)
const limit = ref(25)
const loading = ref(false)
const expandedJobId = ref<string>()
const details = ref<WorkerJobDetails>()
const detailsLoading = ref(false)
const retryingJobId = ref<string>()
const loadedAt = ref(Date.now())
const totalCount = computed(() => Object.values(counts.value).reduce((sum, count) => sum + count, 0))

async function loadJobs() {
  loading.value = true
  const result = await API.getter<WorkerJobSummary[]>('admin/jobs', {
    ...(selectedState.value ? { state: selectedState.value } : {}),
    page: page.value,
    limit: limit.value
  })
  const response = result.ok as WorkerJobsResponse | undefined
  if (response) {
    jobs.value = response.data
    counts.value = response.counts
    meta.value = response.meta
    loadedAt.value = Date.now()
  }
  loading.value = false
}

async function toggleDetails(job: WorkerJobSummary) {
  if (expandedJobId.value === job.id) {
    expandedJobId.value = undefined
    details.value = undefined
    return
  }
  expandedJobId.value = job.id
  details.value = undefined
  detailsLoading.value = true
  const result = await API.getter<WorkerJobDetails>(`admin/jobs/${encodeURIComponent(job.id)}`)
  if (expandedJobId.value === job.id) details.value = result.ok?.data
  detailsLoading.value = false
}

async function retryJob(job: WorkerJobSummary) {
  if (!confirm(t('alerts.areYouSureRetryJob'))) return
  retryingJobId.value = job.id
  const result = await API.setter<WorkerJobSummary>(`admin/jobs/${encodeURIComponent(job.id)}/retry`, {})
  retryingJobId.value = undefined
  if (result.ok) {
    expandedJobId.value = undefined
    details.value = undefined
    await loadJobs()
  }
}

function changeState() {
  page.value = 1
  void loadJobs()
}

function changePageSize() {
  page.value = 1
  void loadJobs()
}

function goToPage(nextPage: number) {
  page.value = nextPage
  void loadJobs()
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
