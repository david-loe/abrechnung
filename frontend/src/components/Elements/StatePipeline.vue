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
                stateColors[Object.keys(stateColors)[index + 1] as State].color +
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
import { State } from '../../../../common/types.js'

export default defineComponent({
  name: 'StatePipeline',
  data() {
    return {
      stateColors
    }
  },
  components: { StateBadge },
  props: { state: { type: String as PropType<State> } },
  beforeMount() {},
  mounted() {}
})
</script>

<style></style>
