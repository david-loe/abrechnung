<template>
  <div class="container py-3">
    <h2 class="mb-3">{{ $t('accesses.confirm/healthCareCost') }}</h2>
    <HealthCareCostList
      class="mb-5"
      endpoint="confirm/healthCareCost"
      :stateFilter="HealthCareCostState.IN_REVIEW_BY_INSURANCE"
      :columns-to-hide="['state', 'editor', 'updatedAt', 'report', 'organisation', 'log.20.date']">
    </HealthCareCostList>
    <button v-if="!show" type="button" class="btn btn-light" @click="show = HealthCareCostState.REVIEW_COMPLETED">
      {{ $t('labels.show') }} <StateBadge :state="HealthCareCostState.REVIEW_COMPLETED" :StateEnum="HealthCareCostState"> </StateBadge>
      <i class="bi bi-chevron-down"></i>
    </button>
    <template v-else>
      <button type="button" class="btn btn-light" @click="show = null">
        {{ $t('labels.hide') }} <StateBadge :state="show" :StateEnum="HealthCareCostState"></StateBadge> <i class="bi bi-chevron-up"></i>
      </button>
      <hr class="hr" />
      <HealthCareCostList
        endpoint="confirm/healthCareCost"
        :stateFilter="show"
        :columns-to-hide="['state', 'report', 'organisation', 'log.20.date']">
      </HealthCareCostList>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { Ref, ref } from 'vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import HealthCareCostList from '@/components/healthCareCost/HealthCareCostList.vue'
import { HealthCareCostState } from '../../../../common/types'

const show: Ref<HealthCareCostState.REVIEW_COMPLETED | null> = ref(null)
</script>

<style></style>
