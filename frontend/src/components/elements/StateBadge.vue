<template>
  <span :class="'badge text-' + stateColors[state].text" :style="'background-color: ' + stateColors[state].color + ';'"
    >{{ $t('states.' + state) }}
  </span>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { stateColors } from '../../../../common/settings.json'
import { TravelState } from '../../../../common/types.js'

export default defineComponent({
  name: 'StateBadge',
  data() {
    return {
      stateColors
    }
  },
  props: { state: { type: String as PropType<TravelState>, required: true } }
})
</script>

<style></style>
