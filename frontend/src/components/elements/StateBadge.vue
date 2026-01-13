<template>
  <Badge :text="t(`states.${StateEnum[state]}`)" :style="APP_DATA?.displaySettings.stateColors[state]" />
</template>

<script lang="ts" setup>
import { AnyState, AnyStateEnum } from 'abrechnung-common/types.js'
import { PropType } from 'vue'
import Badge from '@/components/elements/Badge.vue'
import APP_LOADER from '@/dataLoader.js'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  state: { type: Number as PropType<AnyState>, required: true },
  StateEnum: { type: Object as PropType<AnyStateEnum>, required: true }
})

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data
</script>

<style></style>
