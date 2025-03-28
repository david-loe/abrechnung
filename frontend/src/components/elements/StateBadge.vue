<template>
  <span
    v-if="APP_DATA?.settings.stateColors"
    :class="'badge text-' + APP_DATA.settings.stateColors[state].text"
    :style="'background-color: ' + APP_DATA.settings.stateColors[state].color + ';'"
    >{{ $t('states.' + state) }}
  </span>
  <span v-else class="badge text">
    {{ $t('states.' + state) }}
  </span>
</template>

<script lang="ts">
import APP_LOADER from '@/appData.js'
import { defineComponent, PropType } from 'vue'
import { Settings } from '../../../../common/types.js'

export default defineComponent({
  data() {
    return {
      APP_DATA: APP_LOADER.data
    }
  },
  name: 'StateBadge',
  props: { state: { type: String as PropType<keyof Settings['stateColors']>, required: true } },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
