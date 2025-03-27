<template>
  <div>
    <div v-if="state == 'rejected'">
      <StateBadge :state="state" class="fs-6"></StateBadge>
    </div>
    <div v-else class="row align-items-center justify-content-around m-0 flex-nowrap">
      <template v-for="(value, index) of states">
        <template v-if="value !== 'rejected'">
          <div class="col-auto p-0" :key="value">
            <StateBadge :state="value" :class="state === value ? 'fs-6' : 'fw-normal'"></StateBadge>
          </div>
          <div v-if="value !== 'refunded'" class="col p-0" :key="value">
            <hr
              :style="
                'background: linear-gradient(to right, ' +
                APP_DATA?.settings.stateColors[value].color +
                ', ' +
                APP_DATA?.settings.stateColors[states[index + 1]].color +
                '); height: 5px; border: 0px'
              " />
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import APP_LOADER, { APP_DATA } from '@/appData.js'
import { defineComponent, PropType } from 'vue'
import { Settings } from '../../../../common/types.js'
import StateBadge from './StateBadge.vue'

export default defineComponent({
  data() {
    return {
      APP_DATA: null as APP_DATA | null
    }
  },
  name: 'StatePipeline',
  components: { StateBadge },
  props: {
    state: { type: String as PropType<keyof Settings['stateColors']>, required: true },
    states: { type: Array as PropType<readonly (keyof Settings['stateColors'])[]>, required: true }
  },
  mounted() {},
  async created() {
    APP_LOADER.loadData().then((APP_DATA) => (this.APP_DATA = APP_DATA))
  }
})
</script>

<style></style>
