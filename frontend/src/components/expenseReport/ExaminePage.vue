<template>
  <div>
    <ModalComponent
      ref="modalComp"
      :header="
        modalMode === 'add' ? t('labels.newX', { X: t('labels.expenseReport') }) : t('labels.editX', { X: t('labels.expenseReport') })
      ">
      <ExpenseReportForm
        :mode="modalMode"
        :expenseReport="modalExpenseReport"
        :loading="modalFormIsLoading"
        endpointPrefix="examine/"
        @cancel="resetAndHide()"
        @add="addExpenseReport" />
    </ModalComponent>
    <div class="container py-3">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h2>{{ t('accesses.examine/expenseReport') }}</h2>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ t('labels.createX', { X: t('labels.expenseReport') }) }}</span>
          </button>
        </div>
      </div>
      <ExpenseReportList
        class="mb-5"
        endpoint="examine/expenseReport"
        :stateFilter="ExpenseReportState.IN_REVIEW"
        :columns-to-hide="['state', 'editor', 'updatedAt', 'report', 'addUp.totalTotal', 'organisation', 'bookingRemark']"
        dbKeyPrefix="examine" />
      <template v-if="!show">
        <button type="button" class="btn btn-light me-2" @click="show = ExpenseReportState.IN_WORK">
          {{ t('labels.show') }}
          <StateBadge :state="ExpenseReportState.IN_WORK" :StateEnum="ExpenseReportState" />
          <i class="bi bi-chevron-down"></i>
        </button>
        <button type="button" class="btn btn-light" @click="show = ExpenseReportState.REVIEW_COMPLETED">
          {{ t('labels.show') }}
          <StateBadge :state="ExpenseReportState.REVIEW_COMPLETED" :StateEnum="ExpenseReportState" />
          <i class="bi bi-chevron-down"></i>
        </button>
      </template>
      <template v-else>
        <button type="button" class="btn btn-light" @click="show = null">
          {{ t('labels.hide') }}
          <StateBadge :state="show" :StateEnum="ExpenseReportState" />
          <i class="bi bi-chevron-up"></i>
        </button>
        <hr class="hr" >
        <ExpenseReportList
          endpoint="examine/expenseReport"
          :stateFilter="show === ExpenseReportState.IN_WORK ? show : { $gte: show }"
          :columns-to-hide="['report', 'addUp.totalTotal', 'organisation']"
          dbKeyPrefix="examined" />
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ExpenseReportSimple, ExpenseReportState } from 'abrechnung-common/types.js'
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import ExpenseReportList from '@/components/expenseReport/ExpenseReportList.vue'
import ExpenseReportForm from '@/components/expenseReport/forms/ExpenseReportForm.vue'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()

type ModalMode = 'add' | 'edit'

const show = ref(null as ExpenseReportState.IN_WORK | ExpenseReportState.REVIEW_COMPLETED | null)
const modalExpenseReport = ref({} as Partial<ExpenseReportSimple<string>>)
const modalMode = ref('add' as ModalMode)
const modalFormIsLoading = ref(false)

const modalCompRef = useTemplateRef('modalComp')

function showModal(mode: ModalMode, expenseReport?: Partial<ExpenseReportSimple<string>>) {
  if (expenseReport) {
    modalExpenseReport.value = expenseReport
  }
  modalMode.value = mode
  modalCompRef.value?.modal?.show()
}
function hideModal() {
  modalCompRef.value?.hideModal()
}
function resetModal() {
  modalMode.value = 'add'
  modalExpenseReport.value = {}
}
function resetAndHide() {
  resetModal()
  hideModal()
}
async function addExpenseReport(expenseReport: Partial<ExpenseReportSimple>) {
  modalFormIsLoading.value = true
  const result = await API.setter<ExpenseReportSimple>('examine/expenseReport/inWork', expenseReport)
  modalFormIsLoading.value = false
  if (result.ok) {
    resetAndHide()
  }
}

await APP_LOADER.loadData()
</script>

<style></style>
