<template>
  <Vueform
    :schema="schema"
    ref="form$"
    :endpoint="false"
    @submit="(form$: any) => postDisplaySettings(form$.data)"
    @keydown.ctrl.s.prevent="(e: KeyboardEvent) => {e.repeat ? null: postDisplaySettings(($refs.form$ as any).data)}"></Vueform>
</template>

<script lang="ts">
import { VueformElement, VueformSchema } from '@vueform/vueform'
import { DisplaySettings } from 'abrechnung-common/types.js'
import { defineComponent } from 'vue'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'

const APP_DATA = APP_LOADER.data
export default defineComponent({
  name: 'DisplaySettingsForm',
  data() {
    return { schema: {} }
  },
  methods: {
    async postDisplaySettings(displaySettings: DisplaySettings) {
      const result = await API.setter<DisplaySettings<string>>('admin/displaySettings', displaySettings)
      if (result.ok && APP_DATA.value) {
        APP_DATA.value?.setDisplaySettings(result.ok)
        ;(this.$refs.form$ as VueformElement).load(APP_DATA.value?.displaySettings, false)
      }
    }
  },
  async created() {
    await APP_LOADER.loadData()
    this.schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/displaySettings/form')).ok?.data, {
      buttons: {
        type: 'group',
        schema: { submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } } }
      },
      _id: { type: 'hidden', meta: true }
    })
    queueMicrotask(() => (this.$refs.form$ as VueformElement).load(APP_DATA.value?.displaySettings, false))
  }
})
</script>

<style></style>
