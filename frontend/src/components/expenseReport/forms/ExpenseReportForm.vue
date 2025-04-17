<template>
  <form class="container" @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div v-if="askOwner" class="mb-3">
      <label for="travelFormOwner" class="form-label"> {{ $t('labels.owner') }}<span class="text-danger">*</span> </label>
      <UserSelector v-model="formExpenseReport.owner" required></UserSelector>
    </div>

    <div class="mb-3">
      <label for="expenseReportFormName" class="form-label">
        {{ $t('labels.expenseReportName') }}
      </label>
      <input type="text" class="form-control" id="expenseReportFormName" v-model="formExpenseReport.name" />
    </div>
    <div class="mb-3">
      <label for="expenseReportFormAdvance" class="form-label me-2">
        {{ $t('labels.advanceFromEmployer') }}
      </label>
      <div class="input-group" id="expenseReportFormAdvance">
        <input
          type="number"
          class="form-control"
          step="0.01"
          id="expenseReportFormAdvanceAmount"
          v-model="formExpenseReport.advance.amount" />
        <CurrencySelector v-model="formExpenseReport.advance.currency" required></CurrencySelector>
      </div>
    </div>

    <div class="mb-3">
      <label for="healthCareCostFormProject" class="form-label me-2"> {{ $t('labels.project') }}<span class="text-danger">*</span> </label>
      <InfoPoint :text="$t('info.project')" />
      <ProjectSelector id="healthCareCostFormProject" v-model="formExpenseReport.project" :update-user-org="!askOwner" required>
      </ProjectSelector>
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        {{ mode === 'add' ? $t('labels.addX', { X: $t('labels.expenseReport') }) : $t('labels.save') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" v-on:click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import { ExpenseReportSimple, baseCurrency } from '@/../../common/types.js'
import CurrencySelector from '@/components/elements/CurrencySelector.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import { PropType, defineComponent } from 'vue'

export default defineComponent({
  name: 'ExpenseReportForm',
  components: { InfoPoint, ProjectSelector, CurrencySelector, UserSelector },
  emits: ['cancel', 'edit', 'add'],
  props: {
    expenseReport: {
      type: Object as PropType<Partial<ExpenseReportSimple>>
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    },
    askOwner: {
      type: Boolean,
      default: false
    },
    loading: { type: Boolean, default: false }
  },
  data() {
    return {
      formExpenseReport: this.default()
    }
  },
  methods: {
    default() {
      return {
        name: '',
        advance: {
          amount: null,
          currency: baseCurrency
        },
        owner: null
      }
    },
    clear() {
      this.formExpenseReport = this.default()
    },
    output() {
      return this.formExpenseReport
    },
    input() {
      return Object.assign({}, this.default(), this.expenseReport)
    }
  },
  created() {
    this.formExpenseReport = this.input()
  },
  watch: {
    expenseReport: function () {
      this.formExpenseReport = this.input()
    }
  }
})
</script>

<style></style>
