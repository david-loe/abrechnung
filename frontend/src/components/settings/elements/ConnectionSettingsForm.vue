<template>
  <Vueform
    :schema="schema"
    ref="form$"
    :endpoint="false"
    @submit="(form$: any) => postConnectionSettings(form$.data)"
    @keydown.ctrl.s.prevent="(e: KeyboardEvent) => {e.repeat ? null: postConnectionSettings(($refs.form$ as any).data)}"></Vueform>
</template>

<script lang="ts">
import { ConnectionSettings } from '@/../../common/types.js'
import API from '@/api.js'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ConnectionSettingsForm',
  data() {
    return {
      schema: {},
      connectionSettings: undefined as ConnectionSettings | undefined
    }
  },
  methods: {
    async postConnectionSettings(connectionSettings: ConnectionSettings) {
      if (!connectionSettings.smtp?.host) {
        connectionSettings.smtp = undefined
      }
      if (!connectionSettings.auth.ldapauth?.url) {
        connectionSettings.auth.ldapauth = undefined
      }
      if (!connectionSettings.auth.microsoft?.clientId) {
        connectionSettings.auth.microsoft = undefined
      }
      const result = await API.setter<ConnectionSettings>('admin/connectionSettings', connectionSettings)
      if (result.ok) {
        this.connectionSettings = result.ok
        ;(this.$refs.form$ as any).load(this.connectionSettings)
      }
    }
  },

  async mounted() {
    this.schema = Object.assign({}, (await API.getter<any>('admin/connectionSettings/form')).ok?.data, {
      buttons: {
        type: 'group',
        schema: {
          submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } }
        }
      },
      _id: { type: 'hidden', meta: true }
    })
    this.connectionSettings = (await API.getter<ConnectionSettings>('admin/connectionSettings')).ok?.data
    queueMicrotask(() => (this.$refs.form$ as any).load(this.connectionSettings))
  }
})
</script>

<style></style>
