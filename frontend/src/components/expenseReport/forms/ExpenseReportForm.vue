<template>
  <form class="container" @submit.prevent="$emit(mode, output())">
    <div v-if="!owner" class="mb-3">
      <label for="expenseReportFormOwner" class="form-label"> {{ $t('labels.owner') }}<span class="text-danger">*</span> </label>
      <UserSelector v-model="formExpenseReport.owner" required></UserSelector>
    </div>

    <div class="mb-3">
      <label for="expenseReportFormName" class="form-label">
        {{ $t('labels.expenseReportName') }}
      </label>
      <input type="text" class="form-control" id="expenseReportFormName" v-model="formExpenseReport.name" />
    </div>

    <div v-if="APP_DATA?.categories && APP_DATA?.categories.length > 1" class="mb-3">
      <label for="expenseReportFormCategory" class="form-label"> {{ $t('labels.category') }}<span class="text-danger">*</span> </label>
      <CategorySelector v-model="formExpenseReport.category" id="expenseReportFormCategory" required></CategorySelector>
    </div>

    <div class="mb-3">
      <label for="healthCareCostFormProject" class="form-label me-2"> {{ $t('labels.project') }}<span class="text-danger">*</span> </label>
      <InfoPoint :text="$t('info.project')" />
      <ProjectSelector id="healthCareCostFormProject" v-model="formExpenseReport.project" :update-user-org="updateUserOrg" required>
      </ProjectSelector>
    </div>

    <div class="mb-3" v-if="APP_DATA?.settings.disableReportType.advance === false">
      <label for="expenseReportFormAdvance" class="form-label me-2">
        {{ $t('labels.advanceFromEmployer') }}
      </label>
      <InfoPoint :text="$t('info.advance')" />
      <AdvanceSelector
        id="expenseReportFormAdvance"
        v-model="formExpenseReport.advances"
        :owner="formExpenseReport.owner"
        :project="formExpenseReport.project"
        :setDefault="APP_DATA.settings.autoSelectAvailableAdvances"
        :endpoint-prefix="endpointPrefix"
        multiple></AdvanceSelector>
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
import { ExpenseReportSimple, idDocumentToId, UserWithName } from 'abrechnung-common/types.js'
import { defineComponent, PropType } from 'vue'
import APP_LOADER from '@/appData.js'
import AdvanceSelector from '@/components/elements/AdvanceSelector.vue'
import CategorySelector from '@/components/elements/CategorySelector.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import UserSelector from '@/components/elements/UserSelector.vue'

export default defineComponent({
  name: 'ExpenseReportForm',
  components: { InfoPoint, ProjectSelector, UserSelector, AdvanceSelector, CategorySelector },
  emits: ['cancel', 'edit', 'add'],
  props: {
    expenseReport: { type: Object as PropType<Partial<ExpenseReportSimple>>, required: true },
    mode: { type: String as PropType<'add' | 'edit'>, required: true },
    owner: { type: Object as PropType<UserWithName> },
    updateUserOrg: { type: Boolean, default: false },
    endpointPrefix: { type: String, default: '' },
    loading: { type: Boolean, default: false }
  },
  data() {
    return { APP_DATA: APP_LOADER.data, formExpenseReport: this.default() }
  },
  methods: {
    idDocumentToId,
    default() {
      return { name: '', advances: [], owner: this.owner, category: this.APP_DATA?.defaultCategory }
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
  async created() {
    await APP_LOADER.loadData()
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
