<template>
  <Vueform
    :schema="schema"
    ref="form$"
    :endpoint="false"
    @submit="(form$: any) => postPrinterSettings(form$.data)"
    @keydown.ctrl.s.prevent="(e: KeyboardEvent) => {e.repeat ? null: postPrinterSettings(($refs.form$ as any).data)}"></Vueform>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { PrinterSettings } from '@/../../common/types.js'
import API from '@/api.js'

export default defineComponent({
  name: 'PrinterSettingsForm',
  data() {
    return { schema: {}, printerSettings: undefined as PrinterSettings | undefined }
  },
  methods: {
    async postPrinterSettings(printerSettings: PrinterSettings) {
      const result = await API.setter<PrinterSettings>('admin/printerSettings', printerSettings)
      if (result.ok) {
        this.printerSettings = result.ok
        ;(this.$refs.form$ as any).load(this.printerSettings)
      }
    }
  },

  async mounted() {
    this.schema = Object.assign({}, (await API.getter<any>('admin/printerSettings/form')).ok?.data, {
      buttons: {
        type: 'group',
        schema: { submit: { type: 'button', submits: true, buttonLabel: this.$t('labels.save'), full: true, columns: { container: 6 } } }
      },
      _id: { type: 'hidden', meta: true }
    })
    this.printerSettings = (await API.getter<PrinterSettings>('admin/printerSettings')).ok?.data
    queueMicrotask(() => (this.$refs.form$ as any).load(this.printerSettings))
  }
})
</script>

<style></style>
