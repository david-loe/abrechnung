<template>
  <div v-if="isOffline" id="offline-banner" class="bg-danger-subtle" style="width: 100%; display: flex; justify-content: center">
    {{ t('alerts.offline') }}
    {{ readOnlyMessage }}
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { sessionState } from '@/session.js'

const { t, locale } = useI18n()

const isOffline = computed(() => !sessionState.isOnline.value)
const readOnlyMessage = computed(() => (locale.value === 'de' ? 'Offline ist die Anwendung nur lesbar.' : 'Offline mode is read-only.'))
defineExpose({ isOffline })
</script>
