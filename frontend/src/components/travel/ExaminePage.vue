<template>
  <div class="container">
    <h1 class="mb-3">{{ $t('labels.examine/travel') }}</h1>
    <TravelCardList
      class="mb-5"
      ref="travelCardListRef"
      endpoint="examine/travel"
      :showTraveler="true"
      @clicked="(t) => $router.push('/examine/travel/' + t._id)">
    </TravelCardList>
    <button v-if="!showRefunded" type="button" class="btn btn-light" @click="showRefunded = true">
      {{ $t('labels.showRefundedTravels') }} <i class="bi bi-chevron-down"></i>
    </button>
    <template v-else>
      <button type="button" class="btn btn-light" @click="showRefunded = false">
        {{ $t('labels.hideRefundedTravels') }} <i class="bi bi-chevron-up"></i>
      </button>
      <hr class="hr" />
      <TravelCardList
        endpoint="examine/travel/refunded"
        :showTraveler="true"
        @clicked="(t) => $router.push('/examine/travel/' + t._id + '/%2Frefunded')">
      </TravelCardList>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import TravelCardList from '../Elements/TravelCardList.vue'

export default defineComponent({
  name: 'ExaminePage',
  components: { TravelCardList },
  props: [],
  data() {
    return {
      showRefunded: false
    }
  },
  methods: {},
  async beforeMount() {
    await this.$root.load()
  }
})
</script>

<style></style>
