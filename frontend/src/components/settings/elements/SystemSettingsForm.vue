<template>
  <Vueform :schema="schema" ref="form$" :endpoint="false" @submit="(form$: any) => postSystemSettings(form$.data)"></Vueform>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { SystemSettings } from '../../../../../common/types.js'

export default defineComponent({
  name: 'SystemSettingsForm',
  data() {
    return {
      schema: {},
      systemSettings: undefined as SystemSettings | undefined
    }
  },
  methods: {
    async postSystemSettings(systemSettings: SystemSettings) {
      const result = await this.$root.setter<SystemSettings>('admin/systemSettings', systemSettings)
      if (result.ok) {
        this.systemSettings = result.ok
        ;(this.$refs.form$ as any).load(this.systemSettings)
      }
    }
  },
  async mounted() {
    await this.$root.load()
    this.schema = Object.assign({}, (await this.$root.getter<any>('admin/systemSettings/form')).ok?.data, {
      buttons: {
        type: 'group',
        schema: {
          submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } }
        }
      },
      _id: { type: 'hidden', meta: true }
    })
    this.systemSettings = (await this.$root.getter<SystemSettings>('admin/systemSettings')).ok?.data
    queueMicrotask(() => (this.$refs.form$ as any).load(this.systemSettings))
  }
})
</script>

<style></style>
