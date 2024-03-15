<template>
  <span
    v-if="$root.settings.stateColors"
    :class="'badge text-' + $root.settings.stateColors[state].text"
    :style="'background-color: ' + $root.settings.stateColors[state].color + ';'"
    >{{ $t('states.' + state) }}
  </span>
  <span v-else class="badge text">
    {{ $t('states.' + state) }}
  </span>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { Settings } from '../../../../common/types.js';

export default defineComponent({
  name: 'StateBadge',
  props: { state: { type: String as PropType<keyof Settings['stateColors']>, required: true } },
  async created() {
    await this.$root.load()
  }
})
</script>

<style></style>
