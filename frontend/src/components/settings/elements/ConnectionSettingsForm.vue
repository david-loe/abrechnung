<template>
  <Vueform
    :schema="schema"
    ref="form"
    :endpoint="false"
    @submit="(form$: any) => postConnectionSettings(form$.data)"
    @keydown.ctrl.s.prevent="(e: KeyboardEvent) => {e.repeat ? null: postConnectionSettings(formRef?.data as any)}"></Vueform>
</template>

<script lang="ts" setup>
import { VueformElement, VueformSchema } from '@vueform/vueform'
import { ConnectionSettings } from 'abrechnung-common/types.js'
import { onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'

const { t } = useI18n()
const schema = ref({})

const formRef = useTemplateRef('form')

async function postConnectionSettings(connectionSettings: ConnectionSettings) {
  if (!connectionSettings.smtp?.host) {
    connectionSettings.smtp = null
  }
  if (!connectionSettings.auth.ldapauth?.url) {
    connectionSettings.auth.ldapauth = null
  }
  if (!connectionSettings.auth.microsoft?.clientId) {
    connectionSettings.auth.microsoft = null
  }
  if (!connectionSettings.auth.oidc?.clientId) {
    connectionSettings.auth.oidc = null
  }
  const result = await API.setter<ConnectionSettings>('admin/connectionSettings', connectionSettings)
  if (result.ok) {
    loadConnectionSettings(result.ok)
  }
}
function loadConnectionSettings(connectionSettings: ConnectionSettings) {
  if (connectionSettings) {
    if (connectionSettings.smtp === null) {
      connectionSettings.smtp = undefined
    }
    if (connectionSettings.auth.ldapauth === null) {
      connectionSettings.auth.ldapauth = undefined
    }
    if (connectionSettings.auth.microsoft === null) {
      connectionSettings.auth.microsoft = undefined
    }
    if (connectionSettings.auth.oidc === null) {
      connectionSettings.auth.oidc = undefined
    }
  }
  //@ts-expect-error is wrongly typed as Vueform and not VueformElement
  queueMicrotask(() => (formRef.value as VueformElement).load(connectionSettings, false))
}

onMounted(async () => {
  schema.value = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/connectionSettings/form')).ok?.data, {
    buttons: {
      type: 'group',
      schema: { submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } } }
    },
    _id: { type: 'hidden', meta: true }
  })
  const result = await API.getter<ConnectionSettings>('admin/connectionSettings')
  if (result.ok) {
    loadConnectionSettings(result.ok.data)
  }
})
</script>

<style></style>
