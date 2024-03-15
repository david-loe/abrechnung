<template>
  <div class="container">
    <h1 class="mb-3">{{ $t('accesses.examine/expenseReport') }}</h1>
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
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { ExpenseReportState } from '../../../../common/types.js'
import ExpenseReportCardList from './elements/ExpenseReportCardList.vue'

export default defineComponent({
  name: 'ExaminePage',
  components: { ExpenseReportCardList },
  props: [],
  data() {
    return {
      showRefunded: false
    }
  },
  methods: {
    params(state: ExpenseReportState){
    return {filter: {$and:[{state}]}}
  }
},
  async created() {
    await this.$root.load()
  }
  
})
</script>

<style></style>
