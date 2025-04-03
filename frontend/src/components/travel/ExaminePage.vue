<template>
  <div class="container">
    <h1 class="mb-3">{{ $t('accesses.examine/travel') }}</h1>
    <TravelList
      class="mb-5"
      ref="travelListRef"
      endpoint="examine/travel"
      stateFilter="underExamination"
      :columns-to-hide="['state', 'editor', 'updatedAt', 'report', 'addUp.total.amount', 'organisation']">
    </TravelList>
    <button v-if="!showRefunded" type="button" class="btn btn-light" @click="showRefunded = true">
      {{ $t('labels.showX', { X: $t('labels.refundedTravels') }) }} <i class="bi bi-chevron-down"></i>
    </button>
    <template v-else>
      <button type="button" class="btn btn-light" @click="showRefunded = false">
        {{ $t('labels.hideX', { X: $t('labels.refundedTravels') }) }} <i class="bi bi-chevron-up"></i>
      </button>
      <hr class="hr" />
      <TravelList
        endpoint="examine/travel"
        stateFilter="refunded"
        :columns-to-hide="['state', 'report', 'addUp.total.amount', 'organisation']">
      </TravelList>
    </template>
  </div>
</template>

<script lang="ts">
import APP_LOADER from '@/appData.js'
import { defineComponent } from 'vue'
import TravelList from './TravelList.vue'

export default defineComponent({
  name: 'ExaminePage',
  components: { TravelList },
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
