<template>
  <div v-if="isOffline" id="offline-banner" class="bg-danger-subtle" style="width: 100%; display: flex; justify-content: center">
    Du bist Offline. Die Daten befinden sich unter Umständen nicht auf dem neusten Stand.
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue'

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
