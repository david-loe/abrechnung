<template>
  <section class="card mb-4" :aria-label="t('passkeys.title')">
    <div class="card-body">
      <h3 class="h5 card-title mb-3">{{ t('passkeys.title') }}</h3>
      <p>{{ t('passkeys.description') }}</p>
      <p v-if="!enabled" class="text-body-secondary">{{ t('passkeys.disabled') }}</p>
      <p v-else-if="!supported" class="text-body-secondary">{{ t('passkeys.unsupported') }}</p>
      <p v-if="!sessionState.isOnline.value" class="text-body-secondary">{{ t('passkeys.offline') }}</p>
      <p v-if="loading" role="status">{{ t('passkeys.loading') }}</p>
      <p v-else-if="loadFailed" role="alert">{{ t('passkeys.loadFailed') }}</p>
      <p v-else-if="passkeys.length === 0">{{ t('passkeys.empty') }}</p>
      <ul v-else class="list-unstyled">
        <li v-for="passkey in passkeys" :key="passkey._id" class="border-bottom py-3">
          <form @submit.prevent="rename(passkey)">
            <label :for="`passkey-${passkey._id}`" class="form-label">{{ t('passkeys.name') }}</label>
            <input
              :id="`passkey-${passkey._id}`"
              v-model="passkey.name"
              class="form-control mb-2"
              required
              maxlength="100"
              pattern=".*\S.*"
              :disabled="busy || !sessionState.isOnline.value">
            <p class="small text-body-secondary mb-2">
              {{ t('passkeys.createdAt', { date: d(new Date(passkey.createdAt)) }) }}<br>
              {{ passkey.lastUsedAt ? t('passkeys.lastUsedAt', { date: d(new Date(passkey.lastUsedAt)) }) : t('passkeys.neverUsed') }}
            </p>
            <button class="btn btn-outline-primary me-2" type="submit" :disabled="busy || !sessionState.isOnline.value">
              {{ t('labels.save') }}
            </button>
            <button class="btn btn-outline-danger" type="button" :disabled="busy || !sessionState.isOnline.value" @click="remove(passkey)">
              {{ t('labels.delete') }}
            </button>
          </form>
        </li>
      </ul>
      <form v-if="enabled && supported" class="mt-3" @submit.prevent="add">
        <label for="new-passkey-name" class="form-label">{{ t('passkeys.name') }}</label>
        <input
          id="new-passkey-name"
          v-model="name"
          class="form-control mb-2"
          required
          maxlength="100"
          pattern=".*\S.*"
          :disabled="busy || !sessionState.isOnline.value">
        <button class="btn btn-primary" type="submit" :disabled="busy || loading || loadFailed || !sessionState.isOnline.value">
          {{ t('passkeys.add') }}
        </button>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PasskeySummary } from 'abrechnung-common/passkeys.js'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import { passkeyCancelled, registerPasskey, supportsPasskeys } from '@/passkeys.js'
import { sessionState } from '@/session.js'

defineProps<{ enabled: boolean }>()
const { t, d } = useI18n()
const supported = supportsPasskeys()
const passkeys = ref<PasskeySummary[]>([])
const name = ref('')
const busy = ref(false)
const loading = ref(true)
const loadFailed = ref(false)

onMounted(async () => {
  const result = await API.getter<PasskeySummary[]>('user/passkeys')
  if (result.ok) passkeys.value = result.ok.data
  else loadFailed.value = true
  loading.value = false
})

async function add() {
  if (busy.value || !name.value.trim()) return
  busy.value = true
  try {
    const result = await registerPasskey(name.value.trim())
    if (result) {
      passkeys.value.push(result)
      name.value = ''
    }
  } catch (error) {
    if (!passkeyCancelled(error)) API.addAlert({ type: 'danger', title: '', message: t('passkeys.failed') })
  } finally {
    busy.value = false
  }
}

async function rename(passkey: PasskeySummary) {
  if (busy.value) return
  busy.value = true
  try {
    const result = await API.setter<PasskeySummary>(`user/passkeys/${passkey._id}`, { name: passkey.name })
    if (result.ok) Object.assign(passkey, result.ok)
  } finally {
    busy.value = false
  }
}

async function remove(passkey: PasskeySummary) {
  if (busy.value) return
  busy.value = true
  try {
    if (await API.deleter(`user/passkeys/${passkey._id}`, {})) passkeys.value = passkeys.value.filter(({ _id }) => _id !== passkey._id)
  } finally {
    busy.value = false
  }
}
</script>
