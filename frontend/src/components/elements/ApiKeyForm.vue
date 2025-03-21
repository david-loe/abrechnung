<template>
  <div v-if="props.user.fk && props.user.fk.httpBearer && !token" class="alert alert-warning d-flex align-items-center" role="alert">
    <i class="bi bi-exclamation-triangle-fill me-2"></i>
    <div>{{ $t('alerts.apiKeyAlreadyExists') }}</div>
  </div>

  <template v-if="token">
    <div class="alert alert-info d-flex align-items-center" role="alert">
      <i class="bi bi-info-circle-fill me-2"></i>
      <div>{{ $t('alerts.apiKeyShownOnlyOnce') }}</div>
    </div>
    <div class="input-group mb-3">
      <input class="form-control" type="text" v-model="token" readonly />
      <button class="btn btn-outline-secondary" type="button" @click="copyToClipboard">
        <i class="bi bi-copy"></i><i v-if="copied" class="bi bi-check-lg ms-2"></i>
      </button>
    </div>
  </template>

  <form class="container" @submit.prevent="postApiKey(props.endpoint)">
    <div class="mb-2">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        {{ $t('labels.addX', { X: 'API Key' }) }}
      </button>
      <button
        type="button"
        class="btn btn-light"
        v-on:click="
          //prettier-ignore
          emits('cancel');
          resetForm()
        ">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import API from '@/api'
import { ref } from 'vue'
import { User } from '../../../../common/types'

const props = defineProps<{
  user: User
  endpoint: string
  includeUserIdInRequest?: boolean
}>()

let loading = ref(false)
const copied = ref(false)
let token = ref('')

const emits = defineEmits<{ cancel: []; newKey: [] }>()

const postApiKey = async (endpoint: string) => {
  loading.value = true
  const result = await API.setter<string>(props.endpoint, props.includeUserIdInRequest ? { userId: props.user._id } : undefined)
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
    setTimeout(() => (copied.value = false), 2000) // Meldung nach 2 Sek. ausblenden
  } catch (err) {
    console.error('Fehler beim Kopieren:', err)
  }
}

const resetForm = () => {
  token.value = ''
}

defineExpose({ resetForm })
</script>

<style></style>
