<template>
  <div v-if="isOffline" id="offline-banner" class="bg-danger-subtle" style="width: 100%; display: flex; justify-content: center">
    {{ t('alerts.offline') }}
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const isOffline = ref(!window.navigator.onLine)
defineExpose({ isOffline })

function updateConnectionStatus() {
  isOffline.value = !window.navigator.onLine
}
onMounted(() => {
  window.addEventListener('online', updateConnectionStatus)
  window.addEventListener('offline', updateConnectionStatus)
})
onUnmounted(() => {
  window.removeEventListener('online', updateConnectionStatus)
  window.removeEventListener('offline', updateConnectionStatus)
})
</script>
