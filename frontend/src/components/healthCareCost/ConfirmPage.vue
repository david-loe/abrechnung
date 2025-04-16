<template>
  <div class="container py-3">
    <h2 class="mb-3">{{ $t('accesses.confirm/healthCareCost') }}</h2>
    <HealthCareCostList
      class="mb-5"
      endpoint="confirm/healthCareCost"
      stateFilter="underExaminationByInsurance"
      :columns-to-hide="['state', 'editor', 'updatedAt', 'report', 'organisation', 'log.underExamination.date']">
    </HealthCareCostList>
    <button v-if="!show" type="button" class="btn btn-light" @click="show = 'refunded'">
      {{ $t('labels.showX', { X: $t('labels.refundedX', { X: $t('labels.healthCareCosts') }) }) }} <i class="bi bi-chevron-down"></i>
    </button>
    <template v-else>
      <button type="button" class="btn btn-light" @click="show = null">
        {{ $t('labels.hideX', { X: $t('labels.refundedX', { X: $t('labels.healthCareCosts') }) }) }} <i class="bi bi-chevron-up"></i>
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
import HealthCareCostList from '@/components/healthCareCost/HealthCareCostList.vue'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ExaminePage',
  components: { HealthCareCostList },
  props: [],
  data() {
    return {
      show: null as 'refunded' | null
    }
  },
  methods: {},
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
