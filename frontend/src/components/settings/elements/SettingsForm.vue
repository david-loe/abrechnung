<template>
  <Vueform
    :schema="schema"
    ref="form$"
    :endpoint="false"
    @submit="(form$: any) => postSettings(form$.data)"
    @keydown.ctrl.s.prevent="(e: KeyboardEvent) => {e.repeat ? null: postSettings(($refs.form$ as any).data)}"></Vueform>
</template>

<script lang="ts">
import { VueformElement, VueformSchema } from '@vueform/vueform'
import { defineComponent } from 'vue'
import { Settings } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'

const APP_DATA = APP_LOADER.data

export default defineComponent({
  name: 'SettingsForm',
  data() {
    return { schema: {} }
  },
  methods: {
    async postSettings(settings: Settings) {
      const result = await API.setter<Settings<string>>('admin/settings', settings)
      if (result.ok && APP_DATA.value) {
        APP_DATA.value?.setSettings(result.ok)
        ;(this.$refs.form$ as VueformElement).load(APP_DATA.value?.settings, false)
      }
    }
  },
  async created() {
    await APP_LOADER.loadData()
    this.schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/settings/form')).ok?.data, {
      buttons: {
        type: 'group',
        schema: { submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } } }
      },
      _id: { type: 'hidden', meta: true }
    })

    queueMicrotask(() => (this.$refs.form$ as VueformElement).load(APP_DATA.value?.settings, false))
  }
})
</script>

<style></style>
