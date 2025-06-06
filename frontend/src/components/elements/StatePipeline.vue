<template>
  <div>
    <div v-if="state === State.REJECTED">
      <StateBadge :state="state" :StateEnum="StateEnum" class="fs-6"></StateBadge>
    </div>
    <div v-else class="row align-items-center justify-content-around m-0 flex-nowrap">
      <template v-for="(value, index) of states">
        <template v-if="value !==  State.REJECTED"">
          <div class="col-auto p-0" :key="value">
            <StateBadge :state="value" :StateEnum="StateEnum" :class="state === value ? 'fs-6' : 'fw-normal'"></StateBadge>
          </div>
          <div v-if="value < State.BOOKED" class="col p-0" :key="value">
            <hr
              :style="
                'background: linear-gradient(to right, ' +
                APP_DATA?.displaySettings.stateColors[value].color +
                ', ' +
                APP_DATA?.displaySettings.stateColors[states[index + 1]].color +
                '); height: 5px; border: 0px'
              " />
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { PropType } from 'vue'
import { AnyState, AnyStateEnum, State } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'
import StateBadge from '@/components/elements/StateBadge.vue'

const props = defineProps({
  state: { type: Number as PropType<AnyState>, required: true },
  StateEnum: { type: Object as PropType<AnyStateEnum>, required: true }
})

const states: AnyState[] = Object.values(props.StateEnum).filter((v) => typeof v === 'number')

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data
</script>

<style></style>
