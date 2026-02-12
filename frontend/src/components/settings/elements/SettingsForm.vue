<template>
  <Vueform
    :schema="schema"
    ref="form"
    :endpoint="false"
    @submit="(form$: any) => postSettings(form$.data)"
    @keydown.ctrl.s.prevent="(e: KeyboardEvent) => {e.repeat ? null: postSettings(formRef?.data as any)}" />
</template>

<script lang="ts" setup>
import { VueformElement, VueformSchema } from '@vueform/vueform'
import { Settings } from 'abrechnung-common/types.js'
import { onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import APP_LOADER from '@/dataLoader.js'

const APP_DATA = APP_LOADER.data
const { t } = useI18n()
const schema = ref({})

const formRef = useTemplateRef('form')

async function postSettings(settings: Settings) {
  const result = await API.setter<Settings<string>>('admin/settings', settings)
  if (result.ok && APP_DATA.value) {
    APP_DATA.value.settings = result.ok
    loadSettings(APP_DATA.value?.settings)
  }
}

function loadSettings(settings: Settings) {
  //@ts-expect-error is wrongly typed as Vueform and not VueformElement
  queueMicrotask(() => (formRef.value as VueformElement).load(settings, false))
}

onMounted(async () => {
  schema.value = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/settings/form')).ok?.data, {
    buttons: {
      type: 'group',
      schema: { submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } } }
    }
  })
  await APP_LOADER.loadData()
  if (APP_DATA.value) {
    loadSettings(APP_DATA.value?.settings)
  }
})
</script>

<style></style>
