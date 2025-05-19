<template>
  <div>
    <ModalComponent
      ref="modalComp"
      :header="
        modalMode === 'add' ? $t('labels.newX', { X: $t('labels.expenseReport') }) : $t('labels.editX', { X: $t('labels.expenseReport') })
      ">
      <ExpenseReportForm
        :mode="modalMode"
        :expenseReport="modalExpenseReport"
        :loading="modalFormIsLoading"
        endpointPrefix="examine/"
        @cancel="resetAndHide()"
        @add="addExpenseReport">
      </ExpenseReportForm>
    </ModalComponent>
    <div class="container py-3">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h2>{{ $t('accesses.examine/expenseReport') }}</h2>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', undefined)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.createX', { X: $t('labels.expenseReport') }) }}</span>
          </button>
        </div>
      </div>
      <ExpenseReportList
        class="mb-5"
        endpoint="examine/expenseReport"
        stateFilter="underExamination"
        :columns-to-hide="['state', 'editor', 'updatedAt', 'report', 'addUp.totalTotal', 'organisation', 'bookingRemark']">
      </ExpenseReportList>
      <template v-if="!show">
        <button type="button" class="btn btn-light me-2" @click="show = 'refunded'">
          {{ $t('labels.showX', { X: $t('labels.refundedX', { X: $t('labels.expenseReports') }) }) }} <i class="bi bi-chevron-down"></i>
        </button>
        <button type="button" class="btn btn-light" @click="show = 'inWork'">
          {{ $t('labels.showX', { X: $t('labels.inWorkX', { X: $t('labels.expenseReports') }) }) }} <i class="bi bi-chevron-down"></i>
        </button>
      </template>
      <template v-else>
        <button type="button" class="btn btn-light" @click="show = null">{{ $t('labels.hide') }} <i class="bi bi-chevron-up"></i></button>
        <hr class="hr" />
        <ExpenseReportList
          endpoint="examine/expenseReport"
          :stateFilter="show"
          :columns-to-hide="['state', 'report', 'addUp.totalTotal', 'organisation']">
        </ExpenseReportList>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { ExpenseReportSimple } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import ExpenseReportList from '@/components/expenseReport/ExpenseReportList.vue'
import ExpenseReportForm from '@/components/expenseReport/forms/ExpenseReportForm.vue'
import { defineComponent } from 'vue'

type ModalMode = 'add' | 'edit'
export default defineComponent({
  name: 'ExaminePage',
  components: { ExpenseReportList, ExpenseReportForm, ModalComponent },
  props: [],
  data() {
    return {
      show: null as 'inWork' | 'refunded' | null,
      modalExpenseReport: {} as Partial<ExpenseReportSimple>,
      modalMode: 'add' as ModalMode,
      modalFormIsLoading: false
    }
  },
  methods: {
    showModal(mode: ModalMode, expenseReport?: Partial<ExpenseReportSimple>) {
      if (expenseReport) {
        this.modalExpenseReport = expenseReport
      }
      this.modalMode = mode
      if ((this.$refs.modalComp as typeof ModalComponent).modal) {
        ;(this.$refs.modalComp as typeof ModalComponent).modal.show()
      }
    },
    hideModal() {
      if ((this.$refs.modalComp as typeof ModalComponent).modal) {
        ;(this.$refs.modalComp as typeof ModalComponent).hideModal()
      }
    },
    resetModal() {
      this.modalMode = 'add'
      this.modalExpenseReport = {}
    },
    resetAndHide() {
      this.resetModal()
      this.hideModal()
    },
    async addExpenseReport(expenseReport: ExpenseReportSimple) {
      this.modalFormIsLoading = true
      const result = await API.setter<ExpenseReportSimple>('examine/expenseReport/inWork', expenseReport)
      this.modalFormIsLoading = false
      if (result.ok) {
        this.resetAndHide()
      }
    }
  },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
