<template>
  <Vueform :schema="schema" ref="form$" :endpoint="false" @submit="(form$: any) => postConnectionSettings(form$.data)"></Vueform>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { ConnectionSettings } from '../../../../../common/types.js'

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
      const result = await this.$root.setter<ConnectionSettings>('admin/connectionSettings', connectionSettings)
      if (result.ok) {
        this.connectionSettings = result.ok
        ;(this.$refs.form$ as any).load(this.connectionSettings)
      }
    },
    ctrlS(event: KeyboardEvent) {
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault()
        if (!event.repeat && this.$refs.form$) {
          this.postConnectionSettings((this.$refs.form$ as any).data)
        }
      }
    }
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.ctrlS)
  },
  async mounted() {
    document.addEventListener('keydown', this.ctrlS)
    await this.$root.load()
    this.schema = Object.assign({}, (await this.$root.getter<any>('admin/connectionSettings/form')).ok?.data, {
      buttons: {
        type: 'group',
        schema: {
          submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } }
        }
      },
      _id: { type: 'hidden', meta: true }
    })
    this.connectionSettings = (await this.$root.getter<ConnectionSettings>('admin/connectionSettings')).ok?.data
    queueMicrotask(() => (this.$refs.form$ as any).load(this.connectionSettings))
  }
})
</script>

<style></style>
