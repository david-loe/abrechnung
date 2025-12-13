<template>
  <div class="alert alert-warning d-flex align-items-center" role="alert">
    <i class="bi bi-exclamation-triangle-fill me-2"></i>
    <div>{{ $t('alerts.errorCorrection') }}</div>
  </div>
  <div class="row">
    <div class="col" style="max-width: 400px;">
      <form @submit.prevent="search">
        <div class="position-relative">
          <div v-if="loadingSearch" class="z-1 position-absolute top-50 end-0 translate-middle-y">
            <span class="spinner-border spinner-border-sm me-2"></span>
          </div>
          <input type="text" class="form-control" placeholder="Ref" v-model="searchInput" @input="search" >
        </div>
      </form>
      <form v-if="showForm" @submit.prevent="updateReport">
        <div class="mb-3">
          <label for="expenseReportFormName" class="form-label">
            {{ t('labels.name') }}
            <span class="text-danger">*</span>
          </label>
          <input type="text" class="form-control" id="expenseReportFormName" v-model="report.name" required >
        </div>
        <div class="mb-3">
          <label for="expenseReportFormOwner" class="form-label">
            {{ t('labels.owner') }}
            <span class="text-danger">*</span>
          </label>
          <UserSelector v-model="report.owner" required />
        </div>
        <div class="mb-3">
          <label for="expenseReportFormProject" class="form-label me-2">
            {{ t('labels.project') }}
            <span class="text-danger">*</span>
          </label>
          <ProjectSelector id="expenseReportFormProject" v-model="report.project" required />
        </div>
        <div class="mb-1 d-flex align-items-center">
          <button type="submit" class="btn btn-primary me-2" :disabled="loadingUpdate">{{  t('labels.save') }}</button>
          <span v-if="loadingUpdate" class="spinner-border spinner-border-sm ms-1 me-3"></span>
          <button type="button" class="btn btn-light" @click="reset()">{{ t('labels.cancel') }}</button>
          <button type="button" class="btn btn-danger ms-auto" @click="deleteReport" :disabled="loadingUpdate">
            {{ t('labels.delete') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { idDocumentToId, ProjectSimple, ReportModelName, refStringRegexLax, User, UserSimple } from 'abrechnung-common/types.js'
import { refNumberToString, refStringToNumber } from 'abrechnung-common/utils/scripts.js'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import UserSelector from '@/components/elements/UserSelector.vue'

type ReportSimple = { name: string; owner: UserSimple<string>; project: ProjectSimple<string>; _id: string }
const { t } = useI18n()

const searchInput = ref('')
const loadingSearch = ref(false)
const loadingUpdate = ref(false)
const showForm = ref(false)
let params: { ref: number; type: ReportModelName } = { ref: 0, type: 'Travel' }

function defaultReport() {
  return { name: undefined, owner: undefined, project: undefined }
}
const report = ref<Partial<ReportSimple>>(defaultReport())

function reset(resetSearch = true) {
  report.value = defaultReport()
  showForm.value = false
  if (resetSearch) {
    searchInput.value = ''
  }
}

async function updateReport() {
  if (confirm(t('alerts.areYouSureEdit'))) {
    loadingUpdate.value = true
    await API.setter('admin/tools/report', { ...params, data: report.value })
    loadingUpdate.value = false
    reset()
  }
}

async function deleteReport() {
  loadingUpdate.value = true
  const deleted = await API.deleter('admin/tools/report', { ...params })
  loadingUpdate.value = false
  if (deleted) {
    reset()
  }
}

async function search() {
  const term = searchInput.value.trim()
  if (term) {
    loadingSearch.value = true
    if (refStringRegexLax.exec(term)) {
      params = refStringToNumber(term)
      const result = await API.getter<ReportSimple>('admin/tools/report/ref', params)
      if (result.ok) {
        searchInput.value = refNumberToString(params.ref, params.type)
        report.value = result.ok.data
        showForm.value = true
        loadingSearch.value = false
        return
      }
    }
    reset(false)
    loadingSearch.value = false
  }
}
</script>

<style></style>
