<template>
  <form class="container" @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div class="mb-3">
      <label for="expenseReportFormName" class="form-label">
        {{ $t('labels.expenseReportName') }}
      </label>
      <input type="text" class="form-control" id="expenseReportFormName" v-model="formExpenseReport.name" />
    </div>
    <div class="mb-2">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        {{ mode === 'add' ? $t('labels.addX', { X: $t('labels.expenseReport') }) : $t('labels.save') }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import CurrencySelector from '../../elements/CurrencySelector.vue'
import InfoPoint from '../../elements/InfoPoint.vue'
import PlaceInput from '../../elements/PlaceInput.vue'
import DateInput from '../../elements/DateInput.vue'
import { ExpenseReportSimple, Place } from '../../../../../common/types.js'
import settings from '../../../../../common/settings.json'

interface FormExpenseReport extends Omit<ExpenseReportSimple, 'expensePayer' | 'state' | 'editor' | 'comments' | '_id'> {
  destinationPlace?: Place
}

const defaultExpenseReport: FormExpenseReport = {
  name: ''
}
export default defineComponent({
  name: 'ExpenseReportForm',
  components: { CurrencySelector, InfoPoint, PlaceInput, DateInput },
  emits: ['cancel', 'edit', 'add'],
  props: {
    expenseReport: {
      type: Object as PropType<Partial<ExpenseReportSimple>>,
      default: () => structuredClone(defaultExpenseReport)
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    }
  },
  data() {
    return {
      formExpenseReport: structuredClone(defaultExpenseReport),
      loading: false,
      settings
    }
  },
  methods: {
    clear() {
      this.loading = false
      this.formExpenseReport = structuredClone(defaultExpenseReport)
    },
    output() {
      this.loading = true
      return this.formExpenseReport
    },
    input() {
      this.loading = false
      return Object.assign({}, structuredClone(defaultExpenseReport), this.expenseReport)
    }
  },
  beforeMount() {
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
