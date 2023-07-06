<template>
  <span :class="'badge text-' + $root.stateColors[state].text" :style="'background-color: ' + $root.stateColors[state].color + ';'"
    >{{ $t('states.' + state) }}
  </span>
</template>

<script>
export default {
  name: 'StateBadge',
  props: { state: { type: String } }
}
</script>

<style></style>
