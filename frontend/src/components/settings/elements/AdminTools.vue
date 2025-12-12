<template></template>

<script lang="ts" setup>
import { idDocumentToId, User, UserReplaceReferencesResult, UserSimpleWithProject } from 'abrechnung-common/types.js'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import UserSelector from '@/components/elements/UserSelector.vue'

const { t } = useI18n()

async function updateReport() {
  if (confirm(t('alerts.areYouSureMerge'))) {
    await API.setter('admin/tools/report', {})
  }
}
</script>

<style></style>
