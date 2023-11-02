<template>
  <span
    :class="'badge text-' + $root.settings.stateColors[state].text"
    :style="'background-color: ' + $root.settings.stateColors[state].color + ';'"
    >{{ $t('states.' + state) }}
  </span>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { Settings } from '../../../../common/types.js'

export default defineComponent({
  name: 'StateBadge',
  props: { state: { type: String as PropType<keyof Settings['stateColors']>, required: true } }
})
</script>

<style></style>
