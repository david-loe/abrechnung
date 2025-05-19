<template>
  <Badge :text="$t(`states.${state}`)" :style="APP_DATA?.displaySettings.stateColors[state]"></Badge>
</template>

<script lang="ts">
import { AnyState } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'
import Badge from '@/components/elements/Badge.vue'
import { PropType, defineComponent } from 'vue'

export default defineComponent({
  data() {
    return {
      APP_DATA: APP_LOADER.data
    }
  },
  components: { Badge },
  name: 'StateBadge',
  props: { state: { type: String as PropType<AnyState>, required: true } },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
