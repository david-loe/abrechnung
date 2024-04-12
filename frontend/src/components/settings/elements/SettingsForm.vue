<template>
  <Vueform :schema="schema" ref="form$" :endpoint="false" @submit="(form$: any) => postSettings(form$.data)"></Vueform>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import SettingsFormSchema from '../../../../../common/forms/settings.json'
import { Settings } from '../../../../../common/types.js'

export default defineComponent({
  name: 'SettingsForm',
  data() {
    return {
      schema: Object.assign({}, SettingsFormSchema, {
        buttons: {
          type: 'group',
          schema: {
            submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } }
          }
        },
        _id: { type: 'hidden', meta: true }
      })
    }
  },
  methods: {
    async postSettings(settings: Settings) {
      const result = await this.$root.setter<Settings>('admin/settings', settings)
      if (result.ok) {
        this.$root.settings = result.ok
        ;(this.$refs.form$ as any).load(this.$root.settings)
      }
    }
  },
  async mounted() {
    await this.$root.load()
    if (this.$root.settings.version) {
      ;(this.$refs.form$ as any).load(this.$root.settings)
    }
  }
})
</script>

<style></style>
