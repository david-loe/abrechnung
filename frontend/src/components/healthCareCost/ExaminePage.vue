<template>
  <div class="container">
    <h1 class="mb-3">{{ $t('labels.examine/healthCareCost') }}</h1>
    <HealthCareCostCardList
      class="mb-5"
      endpoint="examine/healthCareCost"
      :showUser="true"
      @clicked="(t) => $router.push('/examine/healthCareCost/' + t._id)">
    </HealthCareCostCardList>
    <button v-if="!showRefunded" type="button" class="btn btn-light" @click="showRefunded = true">
      {{ $t('labels.showX', { X: $t('labels.underExaminationByInsuranceHealthCareCosts') }) }} <i class="bi bi-chevron-down"></i>
    </button>
    <template v-else>
      <button type="button" class="btn btn-light" @click="showRefunded = false">
        {{ $t('labels.hideX', { X: $t('labels.underExaminationByInsuranceHealthCareCosts') }) }} <i class="bi bi-chevron-up"></i>
      </button>
      <hr class="hr" />
      <HealthCareCostCardList
        endpoint="examine/healthCareCost/underExaminationByInsurance"
        :showUser="true"
        @clicked="(t) => $router.push('/examine/healthCareCost/' + t._id)">
      </HealthCareCostCardList>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import HealthCareCostCardList from './elements/HealthCareCostCardList.vue'

export default defineComponent({
  name: 'ExaminePage',
  components: { HealthCareCostCardList },
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