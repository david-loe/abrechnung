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
    <template v-if="!show">
      <button type="button" class="btn btn-light me-2" @click="show = 'refunded'">
        {{ $t('labels.showX', { X: $t('labels.refundedX', { X: $t('labels.travels') }) }) }} <i class="bi bi-chevron-down"></i>
      </button>
      <button type="button" class="btn btn-light" @click="show = 'approved'">
        {{ $t('labels.showX', { X: $t('labels.approvedX', { X: $t('labels.travels') }) }) }} <i class="bi bi-chevron-down"></i>
      </button>
    </template>
    <template v-else>
      <button type="button" class="btn btn-light" @click="show = null">{{ $t('labels.hide') }} <i class="bi bi-chevron-up"></i></button>
      <hr class="hr" />
      <TravelList
        endpoint="examine/travel"
        :stateFilter="show"
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
      show: null as 'approved' | 'refunded' | null
    }
  },
  methods: {},
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
