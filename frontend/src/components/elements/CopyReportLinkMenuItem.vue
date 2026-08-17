<template>
  <li>
    <button type="button" class="dropdown-item" @click="copyLink">
      <span class="me-1"><i :class="copied ? 'bi bi-check-lg' : 'bi bi-link-45deg'"></i></span>
      <span>{{ t(copied ? 'alerts.linkCopied' : 'labels.copyLink') }}</span>
    </button>
  </li>
</template>

<script setup lang="ts">
import type { ReportModelName } from 'abrechnung-common/types.js'
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getReportReferenceUrl } from '@/helper.js'
import { logger } from '@/logger.js'

const props = defineProps<{ reference: number; reportModelName: ReportModelName }>()
const { t } = useI18n()
const copied = ref(false)
let copiedTimeout: ReturnType<typeof setTimeout> | undefined

async function copyLink() {
  try {
    await navigator.clipboard.writeText(getReportReferenceUrl(props.reference, props.reportModelName))
    copied.value = true
    clearTimeout(copiedTimeout)
    copiedTimeout = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    logger.error(`Error copying report link:\n${error}`)
  }
}

onBeforeUnmount(() => clearTimeout(copiedTimeout))
</script>
