<template>
  <div v-if="props.user.fk && props.user.fk.httpBearer && !token" class="alert alert-warning d-flex align-items-center" role="alert">
    <i class="bi bi-exclamation-triangle-fill me-2"></i>
    <div>{{ t('alerts.apiKeyAlreadyExists') }}</div>
  </div>

  <template v-if="token">
    <div class="alert alert-info d-flex align-items-center" role="alert">
      <i class="bi bi-info-circle-fill me-2"></i>
      <div>{{ t('alerts.apiKeyShownOnlyOnce') }}</div>
    </div>
    <div class="input-group mb-3">
      <input class="form-control" type="text" v-model="token" readonly >
      <button class="btn btn-outline-secondary" type="button" @click="copyToClipboard">
        <i class="bi bi-copy"></i><i v-if="copied" class="bi bi-check-lg ms-2"></i>
      </button>
    </div>
  </template>

  <form class="container" @submit.prevent="postApiKey(props.endpoint)">
    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">{{ t('labels.addX', { X: 'API Key' }) }}</button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button
        type="button"
        class="btn btn-light"
        v-on:click="
          emits('cancel');
          resetForm()
        ">
        {{ t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { User } from 'abrechnung-common/types.js'
import { PropType, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import { logger } from '@/logger.js'

const { t } = useI18n()

const props = defineProps({
  user: { type: Object as PropType<User>, required: true },
  endpoint: { type: String, required: true },
  includeUserIdInRequest: { type: Boolean, default: false }
})

const loading = ref(false)
const copied = ref(false)
const token = ref('')

const emits = defineEmits<{ cancel: []; newKey: [] }>()

const resetForm = () => {
  token.value = ''
}
defineExpose({ resetForm })

const postApiKey = async (endpoint: string) => {
  loading.value = true
  const result = await API.setter<string>(endpoint, props.includeUserIdInRequest ? { userId: props.user._id } : undefined)
  if (result.ok) {
    token.value = result.ok
    emits('newKey')
  }
  loading.value = false
}

const copyToClipboard = async () => {
  if (!token.value) return
  try {
    await navigator.clipboard.writeText(token.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000) // Meldung nach 2 Sek. ausblenden
  } catch (err) {
    logger.error(`Fehler beim Kopieren:\n${err}`)
  }
}
</script>

<style></style>
