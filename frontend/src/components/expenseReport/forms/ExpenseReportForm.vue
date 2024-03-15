<template>
  <form class="container" @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div class="mb-3">
      <label for="expenseReportFormName" class="form-label">
        {{ $t('labels.expenseReportName') }}
      </label>
      <input type="text" class="form-control" id="expenseReportFormName" v-model="formExpenseReport.name" />
    </div>
    <div class="mb-3">
      <label for="healthCareCostFormOrganisation" class="form-label me-2">
        {{ $t('labels.organisation') }}<span class="text-danger">*</span>
      </label>
      <InfoPoint :text="$t('info.organisation')" />
      <select
        class="form-select"
        id="healthCareCostFormOrganisation"
        v-model="$root.user.settings.organisation"
        @update:model-value="settingsChanged = true"
        required>
        <option v-for="organisation of $root.organisations" :value="organisation" :key="organisation._id">
          {{ organisation.name }}
        </option>
      </select>
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
import { ExpenseReportSimple } from '../../../../../common/types.js'
import InfoPoint from '../../elements/InfoPoint.vue'

export default defineComponent({
  name: 'ExpenseReportForm',
  components: { InfoPoint },
  emits: ['cancel', 'edit', 'add'],
  props: {
    expenseReport: {
      type: Object as PropType<Partial<ExpenseReportSimple>>
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    }
  },
  data() {
    return {
      formExpenseReport: this.default(),
      loading: false,
      settingsChanged: false
    }
  },
  methods: {
    default() {
      return { name: '' }
    },
    clear() {
      this.loading = false
      this.formExpenseReport = this.default()
      this.settingsChanged = false
    },
    output() {
      this.loading = true
      if (this.settingsChanged) {
        this.$root.pushUserSettings(this.$root.user.settings)
      }
      this.formExpenseReport.organisation = this.$root.user.settings.organisation
      return this.formExpenseReport
    },
    input() {
      this.loading = false
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
