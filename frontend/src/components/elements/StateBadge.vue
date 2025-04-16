<template>
  <span
    v-if="APP_DATA?.displaySettings.stateColors"
    :class="'badge text-' + APP_DATA.displaySettings.stateColors[state].text"
    :style="'background-color: ' + APP_DATA.displaySettings.stateColors[state].color + ';'"
    >{{ $t('states.' + state) }}
  </span>
  <span v-else class="badge text">
    {{ $t('states.' + state) }}
  </span>
</template>

<script lang="ts">
import { AnyState } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'
import { defineComponent, PropType } from 'vue'

export default defineComponent({
  data() {
    return {
      APP_DATA: APP_LOADER.data
    }
  },
  name: 'StateBadge',
  props: { state: { type: String as PropType<AnyState>, required: true } },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
