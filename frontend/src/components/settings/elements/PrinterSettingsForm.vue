<template>
  <Vueform
    :schema="schema"
    ref="form"
    :endpoint="false"
    @submit="(form$: any) => postPrinterSettings(form$.data)"
    @keydown.ctrl.s.prevent="(e: KeyboardEvent) => {e.repeat ? null: postPrinterSettings(formRef?.data as any)}" />
</template>

<script lang="ts" setup>
import { VueformElement, VueformSchema } from '@vueform/vueform'
import { PrinterSettings } from 'abrechnung-common/types.js'
import { onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'

const { t } = useI18n()
const schema = ref({})

const formRef = useTemplateRef('form')

async function postPrinterSettings(printerSettings: PrinterSettings) {
  const result = await API.setter<PrinterSettings>('admin/printerSettings', printerSettings)
  if (result.ok) {
    loadPrinterSettings(result.ok)
  }
}
function loadPrinterSettings(printerSettings: PrinterSettings) {
  //@ts-expect-error is wrongly typed as Vueform and not VueformElement
  queueMicrotask(() => (formRef.value as VueformElement).load(printerSettings, false))
}

onMounted(async () => {
  schema.value = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/printerSettings/form')).ok?.data, {
    buttons: {
      type: 'group',
      schema: { submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } } }
    },
    _id: { type: 'hidden', meta: true }
  })
  const result = await API.getter<PrinterSettings>('admin/printerSettings')
  if (result.ok) {
    loadPrinterSettings(result.ok.data)
  }
})
</script>

<style></style>
