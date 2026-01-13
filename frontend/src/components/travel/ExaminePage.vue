<template>
  <div class="container py-3">
    <h2 class="mb-3">{{ t('accesses.examine/travel') }}</h2>
    <TravelList
      class="mb-5"
      ref="travelListRef"
      endpoint="examine/travel"
      :stateFilter="TravelState.IN_REVIEW"
      :columns-to-hide="['state', 'editor', 'updatedAt', 'report', 'addUp.totalTotal', 'organisation', 'bookingRemark','addUp.totalAdvance', 'reference']"
      dbKeyPrefix="examine" />
    <template v-if="!show">
      <button type="button" class="btn btn-light me-2" @click="show = TravelState.APPROVED">
        {{ t('labels.show') }}
        <StateBadge :state="TravelState.APPROVED" :StateEnum="TravelState" />
        <i class="bi bi-chevron-down"></i>
      </button>
      <button type="button" class="btn btn-light" @click="show = TravelState.REVIEW_COMPLETED">
        {{ t('labels.show') }}
        <StateBadge :state="TravelState.REVIEW_COMPLETED" :StateEnum="TravelState" />
        <i class="bi bi-chevron-down"></i>
      </button>
    </template>
    <template v-else>
      <button type="button" class="btn btn-light" @click="show = null">
        {{ t('labels.hide') }}
        <StateBadge :state="show" :StateEnum="TravelState" />
        <i class="bi bi-chevron-up"></i>
      </button>
      <hr class="hr" >
      <TravelList
        endpoint="examine/travel"
        :stateFilter="show === TravelState.APPROVED ? show : { $gte: show }"
        :columns-to-hide="['report', 'organisation', 'reference',  ...(show === TravelState.APPROVED ? ['addUp.totalBalance'] : ['addUp.totalTotal', 'addUp.totalAdvance' ])]"
        dbKeyPrefix="examined" />
    </template>
  </div>
</template>

<script lang="ts" setup>
import { TravelState } from 'abrechnung-common/types.js'
import { Ref, ref } from 'vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import TravelList from '@/components/travel/TravelList.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const show: Ref<TravelState.APPROVED | TravelState.REVIEW_COMPLETED | null> = ref(null)
</script>

<style></style>
