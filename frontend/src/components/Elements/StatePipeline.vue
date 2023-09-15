<template>
  <div>
    <div v-if="state == 'rejected'">
      <StateBadge :state="state" class="fs-6"></StateBadge>
    </div>
    <div v-else class="row align-items-center justify-content-around m-0 flex-nowrap">
      <template v-for="(value, index) of travelStates">
        <template v-if="value !== 'rejected'">
          <div class="col-auto p-0" :key="value">
            <StateBadge :state="value" :class="state === value ? 'fs-6' : 'fw-normal'"></StateBadge>
          </div>
          <div v-if="value !== 'refunded'" class="col p-0" :key="value">
            <hr
              :style="
                'background: linear-gradient(to right, ' +
                stateColors[value].color +
                ', ' +
                stateColors[travelStates[index + 1]].color +
                '); height: 5px; border: 0px'
              " />
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import StateBadge from './StateBadge.vue'
import { stateColors } from '../../../../common/settings.json'
import { TravelState, travelStates } from '../../../../common/types.js'

export default defineComponent({
  name: 'StatePipeline',
  data() {
    return {
      stateColors,
      travelStates
    }
  },
  components: { StateBadge },
  props: { state: { type: String as PropType<TravelState> } },
  beforeMount() {},
  mounted() {}
})
</script>

<style></style>
