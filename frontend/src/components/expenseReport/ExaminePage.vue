<template>
  <div>
    <ModalComponent
      ref="modalComp"
      @reset="reset()"
      :header="
        modalMode === 'add' ? $t('labels.newX', { X: $t('labels.expenseReport') }) : $t('labels.editX', { X: $t('labels.expenseReport') })
      "
      :showModalBody="modalExpenseReport ? true : false">
      <div v-if="modalExpenseReport">
        <ExpenseReportForm
          ref="expenseReportForm"
          :mode="modalMode"
          :expenseReport="modalExpenseReport"
          @cancel="hideModal()"
          @add="addExpenseReport"
          askOwner>
        </ExpenseReportForm>
      </div>
    </ModalComponent>
    <div class="container">
      <div class="row mb-3 justify-content-end gx-4 gy-2">
        <div class="col-auto me-auto">
          <h1>{{ $t('accesses.examine/expenseReport') }}</h1>
        </div>
        <div class="col-auto">
          <button class="btn btn-secondary" @click="showModal('add', {} as ExpenseReportSimple)">
            <i class="bi bi-plus-lg"></i>
            <span class="ms-1">{{ $t('labels.createX', { X: $t('labels.expenseReport') }) }}</span>
          </button>
        </div>
      </div>
      <ExpenseReportCardList
        class="mb-5"
        endpoint="examine/expenseReport"
        :params="params('underExamination')"
        :showOwner="true"
        :showSearch="true"
        @clicked="(t) => $router.push('/examine/expenseReport/' + t._id)">
      </ExpenseReportCardList>
      <button v-if="!showRefunded" type="button" class="btn btn-light" @click="showRefunded = true">
        {{ $t('labels.showX', { X: $t('labels.refundedExpenseReports') }) }} <i class="bi bi-chevron-down"></i>
      </button>
      <template v-else>
        <button type="button" class="btn btn-light" @click="showRefunded = false">
          {{ $t('labels.hideX', { X: $t('labels.refundedExpenseReports') }) }} <i class="bi bi-chevron-up"></i>
        </button>
        <hr class="hr" />
        <ExpenseReportCardList
          endpoint="examine/expenseReport"
          :params="params('refunded')"
          :showOwner="true"
          :showSearch="true"
          @clicked="(t) => $router.push('/examine/expenseReport/' + t._id)">
        </ExpenseReportCardList>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { ExpenseReportSimple, ExpenseReportState } from '../../../../common/types.js'
import ModalComponent from '../elements/ModalComponent.vue'
import ExpenseReportCardList from './elements/ExpenseReportCardList.vue'
import ExpenseReportForm from './forms/ExpenseReportForm.vue'

type ModalMode = 'add' | 'edit'
export default defineComponent({
  name: 'ExaminePage',
  components: { ExpenseReportCardList, ExpenseReportForm, ModalComponent },
  props: [],
  data() {
    return {
      showRefunded: false,
      modalExpenseReport: undefined as ExpenseReportSimple | undefined,
      modalMode: 'add' as ModalMode
    }
  },
  methods: {
    params(state: ExpenseReportState) {
      return { filter: { $and: [{ state }] } }
    },
    showModal(mode: ModalMode, expenseReport: ExpenseReportSimple | undefined) {
      this.modalExpenseReport = expenseReport
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
    reset() {
      if (this.$refs.expenseReportForm) {
        ;(this.$refs.expenseReportForm as typeof ExpenseReportForm).clear()
      }
      this.modalExpenseReport = undefined
    },
    async addExpenseReport(expenseReport: ExpenseReportSimple) {
      const result = await this.$root.setter<ExpenseReportSimple>('examine/expenseReport/inWork', expenseReport)
      if (result.ok) {
        ;(this.$refs.modalComp as typeof ModalComponent).hideModal()
      } else {
        ;(this.$refs.expenseReportForm as typeof ExpenseReportForm).loading = false
      }
    }
  },
  async created() {
    await this.$root.load()
  }
})
</script>

<style></style>
