<template>
  <Badge :text="$t(`states.${StateEnum[state]}`)" :style="APP_DATA?.displaySettings.stateColors[state]"></Badge>
</template>

<script lang="ts" setup>
import { PropType } from 'vue'
import { AnyState, AnyStateEnum } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'
import Badge from '@/components/elements/Badge.vue'

defineProps({
  state: { type: Number as PropType<AnyState>, required: true },
  StateEnum: { type: Object as PropType<AnyStateEnum>, required: true }
})

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data
</script>

<style></style>
