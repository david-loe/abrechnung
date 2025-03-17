<template>
  <div class="container">
    <h1 class="mb-3">{{ $t('accesses.examine/travel') }}</h1>
    <TravelCardList
      class="mb-5"
      ref="travelCardListRef"
      endpoint="examine/travel"
      stateFilter="underExamination"
      :showOwner="true"
      :showSearch="true"
      @clicked="(t) => $router.push('/examine/travel/' + t._id)">
    </TravelCardList>
    <button v-if="!showRefunded" type="button" class="btn btn-light" @click="showRefunded = true">
      {{ $t('labels.showX', { X: $t('labels.refundedTravels') }) }} <i class="bi bi-chevron-down"></i>
    </button>
    <template v-else>
      <button type="button" class="btn btn-light" @click="showRefunded = false">
        {{ $t('labels.hideX', { X: $t('labels.refundedTravels') }) }} <i class="bi bi-chevron-up"></i>
      </button>
      <hr class="hr" />
      <TravelCardList
        endpoint="examine/travel"
        stateFilter="refunded"
        :showOwner="true"
        :showSearch="true"
        @clicked="(t) => $router.push('/examine/travel/' + t._id)">
      </TravelCardList>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { TravelState } from '../../../../common/types.js'
import TravelCardList from './elements/TravelList.vue'

export default defineComponent({
  name: 'ExaminePage',
  components: { TravelCardList },
  props: [],
  data() {
    return {
      showRefunded: false
    }
  },
  methods: {
    params(state: TravelState) {
      return { filter: { $and: [{ state }] } }
    }
  },
  async created() {
    await this.$root.load()
  }
})
</script>

<style></style>
