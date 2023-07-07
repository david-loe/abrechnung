<template>
  <span :class="'badge text-' + $root.stateColors[state].text" :style="'background-color: ' + $root.stateColors[state].color + ';'"
    >{{ $t('states.' + state) }}
  </span>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'StateBadge',
  props: { state: { type: String, required: true } }
})
</script>

<style></style>
