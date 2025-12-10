<template>
  <div v-if="APP_DATA?.settings.isReadOnly" class="bg-danger-subtle" style="width: 100%; display: flex; justify-content: center">
    {{ t('alerts.isReadOnly') }}
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()

const APP_DATA = APP_LOADER.data
</script>
