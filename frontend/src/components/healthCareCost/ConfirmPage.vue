<template>
  <div class="container">
    <h1 class="mb-3">{{ $t('accesses.confirm/healthCareCost') }}</h1>
    <HealthCareCostList
      class="mb-5"
      endpoint="confirm/healthCareCost"
      stateFilter="underExaminationByInsurance"
      :columns-to-hide="['state', 'editor', 'updatedAt', 'report', 'organisation', 'log.underExamination.date']">
    </HealthCareCostList>
    <button v-if="!showRefunded" type="button" class="btn btn-light" @click="showRefunded = true">
      {{ $t('labels.showX', { X: $t('labels.refundedHealthCareCosts') }) }} <i class="bi bi-chevron-down"></i>
    </button>
    <template v-else>
      <button type="button" class="btn btn-light" @click="showRefunded = false">
        {{ $t('labels.hideX', { X: $t('labels.refundedHealthCareCosts') }) }} <i class="bi bi-chevron-up"></i>
      </button>
      <hr class="hr" />
      <HealthCareCostList
        endpoint="confirm/healthCareCost"
        stateFilter="refunded"
        :columns-to-hide="['state', 'report', 'organisation', 'log.underExamination.date']">
      </HealthCareCostList>
    </template>
  </div>
</template>

<script lang="ts">
import APP_LOADER from '@/appData.js'
import { defineComponent } from 'vue'
import HealthCareCostList from './HealthCareCostList.vue'

export default defineComponent({
  name: 'ExaminePage',
  components: { HealthCareCostList },
  props: [],
  data() {
    return {
      showRefunded: false
    }
  },
  methods: {},
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
