<template>
  <Vueform
    :schema="schema"
    ref="form$"
    :endpoint="false"
    @submit="(form$: any) => postConnectionSettings(form$.data)"
    @keydown.ctrl.s.prevent="(e: KeyboardEvent) => {e.repeat ? null: postConnectionSettings(($refs.form$ as any).data)}"></Vueform>
</template>

<script lang="ts">
import { VueformElement, VueformSchema } from '@vueform/vueform'
import { ConnectionSettings } from 'abrechnung-common/types.js'
import { defineComponent } from 'vue'
import API from '@/api.js'

export default defineComponent({
  name: 'ConnectionSettingsForm',
  data() {
    return { schema: {} }
  },
  methods: {
    async postConnectionSettings(connectionSettings: ConnectionSettings) {
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
        this.loadConnectionSettings(result.ok)
      }
    },
    loadConnectionSettings(connectionSettings: ConnectionSettings) {
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
      queueMicrotask(() => (this.$refs.form$ as VueformElement).load(connectionSettings, false))
    }
  },

  async mounted() {
    this.schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/connectionSettings/form')).ok?.data, {
      buttons: {
        type: 'group',
        schema: { submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } } }
      },
      _id: { type: 'hidden', meta: true }
    })
    const result = await API.getter<ConnectionSettings>('admin/connectionSettings')
    if (result.ok) {
      this.loadConnectionSettings(result.ok.data)
    }
  }
})
</script>

<style></style>
