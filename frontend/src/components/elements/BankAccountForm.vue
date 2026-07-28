<template>
  <form @submit.prevent="save">
    <div class="mb-3">
      <label class="form-label" for="bank-account-holder">{{ t('labels.accountHolder') }}</label>
      <input id="bank-account-holder" v-model.trim="bankAccount.accountHolder" class="form-control" required >
    </div>
    <div class="mb-3">
      <label class="form-label" for="bank-account-iban">IBAN</label>
      <input id="bank-account-iban" v-model.trim="bankAccount.iban" class="form-control" autocomplete="off" required >
    </div>
    <div class="mb-3">
      <label class="form-label" for="bank-account-bic">BIC</label>
      <input id="bank-account-bic" v-model.trim="bankAccount.bic" class="form-control" autocomplete="off" >
    </div>
    <div class="d-flex gap-2">
      <button type="submit" class="btn btn-primary" :disabled="loading">{{ t('labels.save') }}</button>
      <button v-if="props.modelValue" type="button" class="btn btn-outline-danger" :disabled="loading" @click="remove">
        {{ t('labels.delete') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { BankAccount, User } from 'abrechnung-common/types.js'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'

const props = defineProps<{ modelValue?: BankAccount | null }>()
const emit = defineEmits<{ 'update:modelValue': [BankAccount | null] }>()
const { t } = useI18n()
const loading = ref(false)
const bankAccount = reactive<BankAccount>({ accountHolder: '', iban: '', bic: '' })

watch(
  () => props.modelValue,
  (value) => Object.assign(bankAccount, { accountHolder: value?.accountHolder ?? '', iban: value?.iban ?? '', bic: value?.bic ?? '' }),
  { immediate: true }
)

async function save() {
  loading.value = true
  const value = {
    accountHolder: bankAccount.accountHolder.trim(),
    iban: bankAccount.iban,
    bic: bankAccount.bic || undefined
  }
  const result = await API.setter<User['settings']>('user/settings', { bankAccount: value })
  loading.value = false
  if (result.ok) emit('update:modelValue', result.ok.bankAccount ?? null)
}

async function remove() {
  loading.value = true
  const result = await API.setter<User['settings']>('user/settings', { bankAccount: null })
  loading.value = false
  if (result.ok) emit('update:modelValue', null)
}
</script>
