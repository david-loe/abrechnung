<template>
  <span class="badge text-bg-secondary clickable" @click="copyToClipboard">
    {{ refString }}
    <span class="icon ms-1">
      <i v-if="copied" class="bi bi-check-lg"></i>
      <i v-else class="bi bi-copy"></i>
    </span>
  </span>
</template>

<script lang="ts" setup>
import { ReportModelName } from 'abrechnung-common/types.js'
import { refNumberToString } from 'abrechnung-common/utils/scripts.js'
import { computed, PropType, ref } from 'vue'
import { logger } from '@/logger'

const props = defineProps({ number: { type: Number, required: true }, type: { type: String as PropType<ReportModelName>, required: true } })

const refString = computed(() => refNumberToString(props.number, props.type))

const copied = ref(false)

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(refString.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000) // Meldung nach 2 Sek. ausblenden
  } catch (err) {
    logger.error(`Error on Copy:\n${err}`)
  }
}
</script>

<style scoped>
.badge .icon {
  display: none;
}

.badge:hover .icon {
  display: inline;
}
</style>
