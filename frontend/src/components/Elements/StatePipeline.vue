<template>
  <div>
    <div v-if="state == 'rejected'">
      <StateBadge :state="state" class="fs-6"></StateBadge>
    </div>
    <div v-else class="row align-items-center justify-content-around m-0 flex-nowrap">
      <template v-for="(value, key, index) in stateColors">
        <template v-if="key !== 'rejected'">
          <div class="col-auto p-0" :key="key">
            <StateBadge :state="key" :class="state === key ? 'fs-6' : 'fw-normal'"></StateBadge>
          </div>
          <div v-if="key !== 'refunded'" class="col p-0" :key="key">
            <hr
              :style="
                'background: linear-gradient(to right, ' +
                stateColors[key].color +
                ', ' +
                stateColors[Object.keys(stateColors)[index + 1]].color +
                '); height: 5px; border: 0px'
              " />
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script>
import StateBadge from './StateBadge.vue'
import { stateColors } from '../../../../common/settings.json'

export default {
  name: 'StatePipeline',
  data() {
    return {
      stateColors
    }
  },
  components: { StateBadge },
  props: { state: { type: String } },
  beforeMount() {},
  mounted() {}
}
</script>

<style></style>
