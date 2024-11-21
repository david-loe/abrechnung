<template>
  <Vueform
    :schema="schema"
    ref="form$"
    :endpoint="false"
    @submit="(form$: any) => postDisplaySettings(form$.data)"
    @keydown.ctrl.s.prevent="() => postDisplaySettings(($refs.form$ as any).data)"></Vueform>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { DisplaySettings } from '../../../../../common/types.js'

export default defineComponent({
  name: 'DisplaySettingsForm',
  data() {
    return {
      schema: {},
      displaySettings: undefined as DisplaySettings | undefined
    }
  },
  methods: {
    async postDisplaySettings(displaySettings: DisplaySettings) {
      const result = await this.$root.setter<DisplaySettings>('admin/displaySettings', displaySettings)
      if (result.ok) {
        this.displaySettings = result.ok
        ;(this.$refs.form$ as any).load(this.displaySettings)
      }
    }
  },
  async mounted() {
    await this.$root.load()
    this.schema = Object.assign({}, (await this.$root.getter<any>('admin/displaySettings/form')).ok?.data, {
      buttons: {
        type: 'group',
        schema: {
          submit: {
            type: 'button',
            submits: true,
            buttonLabel: this.$t('labels.save'),
            full: true,
            columns: { container: 6 },
            id: 'submit-button'
          }
        }
      },
      _id: { type: 'hidden', meta: true }
    })
    this.displaySettings = (await this.$root.getter<DisplaySettings>('displaySettings')).ok?.data
    queueMicrotask(() => (this.$refs.form$ as any).load(this.displaySettings))
  }
})
</script>

<style></style>
