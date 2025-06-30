<template>
  <Vueform
    :schema="schema"
    ref="form$"
    :endpoint="false"
    @submit="(form$: any) => postTravelSettings(form$.data)"
    @keydown.ctrl.s.prevent="(e: KeyboardEvent) => {e.repeat ? null: postTravelSettings(($refs.form$ as any).data)}"></Vueform>
</template>

<script lang="ts">
import { VueformElement, VueformSchema } from '@vueform/vueform'
import { defineComponent } from 'vue'
import { TravelSettings } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'

const APP_DATA = APP_LOADER.data

export default defineComponent({
  name: 'TravelSettingsForm',
  data() {
    return { schema: {} }
  },
  methods: {
    async postTravelSettings(travelSettings: TravelSettings) {
      const result = await API.setter<TravelSettings>('admin/travelSettings', travelSettings)
      if (result.ok && APP_DATA.value) {
        APP_DATA.value?.setTravelSettings(result.ok)
        ;(this.$refs.form$ as VueformElement).load(APP_DATA.value?.travelSettings, false)
      }
    }
  },
  async created() {
    await APP_LOADER.loadData()
    this.schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/travelSettings/form')).ok?.data, {
      buttons: {
        type: 'group',
        schema: { submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } } }
      },
      _id: { type: 'hidden', meta: true }
    })
    queueMicrotask(() => {
      if (APP_DATA.value) {
        ;(this.$refs.form$ as VueformElement).load(APP_DATA.value?.travelSettings, false)
      }
    })
  }
})
</script>

<style></style>
