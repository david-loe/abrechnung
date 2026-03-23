<template>
  <Vueform
    :schema="schema"
    ref="form"
    :endpoint="false"
    @submit="(form$: any) => postRetentionSettings(form$.data)"
    @keydown.ctrl.s.prevent="(event: KeyboardEvent) => { event.repeat ? null : postRetentionSettings(formRef?.data as any) }" />
</template>

<script lang="ts" setup>
import { VueformElement, VueformSchema } from '@vueform/vueform'
import { RetentionSettings } from 'abrechnung-common/types.js'
import { onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'

const { t } = useI18n()
const schema = ref({})

const formRef = useTemplateRef('form')

async function postRetentionSettings(settings: RetentionSettings) {
  const result = await API.setter<RetentionSettings<string>>('admin/retentionSettings', settings)
  if (result.ok) {
    loadRetentionSettings(result.ok)
  }
}

function loadRetentionSettings(settings: RetentionSettings) {
  //@ts-expect-error is wrongly typed as Vueform and not VueformElement
  queueMicrotask(() => (formRef.value as VueformElement).load(settings, false))
}

onMounted(async () => {
  schema.value = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/retentionSettings/form')).ok?.data, {
    buttons: {
      type: 'group',
      schema: { submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } } }
    }
  })

  const result = await API.getter<RetentionSettings<string>>('admin/retentionSettings')
  if (result.ok) {
    loadRetentionSettings(result.ok.data)
  }
})
</script>
