<template>
  <Vueform
    :schema="schema"
    ref="form"
    :endpoint="false"
    @submit="(form$: any) => postRetentionSettings(form$.requestData)"
    @keydown.ctrl.s.prevent="(event: KeyboardEvent) => { event.repeat ? null : postRetentionSettings((formRef?.requestData ?? {}) as any) }" />
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

function buildSchedulerSchema(scheduleSchema: VueformSchema | undefined): VueformSchema {
  return {
    ...(scheduleSchema ?? {}),
    type: 'schedule',
    addClasses: {
      ...((scheduleSchema?.addClasses as object | undefined) ?? {}),
      ElementLabel: { wrapper: 'h5' },
      ElementLayout: { container: 'mb-2' }
    }
  }
}

async function postRetentionSettings(settings: RetentionSettings) {
  const result = await API.setter<RetentionSettings<string>>('admin/retentionSettings', settings)
  if (result.ok) {
    loadRetentionSettings(result.ok)
  }
}

function loadRetentionSettings(settings: RetentionSettings) {
  queueMicrotask(() => {
    const form = formRef.value as VueformElement | null
    form?.load({ retentionPolicy: settings.retentionPolicy, scheduler: { enabled: settings.enabled, schedule: settings.schedule } }, true)
  })
}

onMounted(async () => {
  const [schemaResult, retentionSettingsResult] = await Promise.all([
    API.getter<{ [key: string]: VueformSchema }>('admin/retentionSettings/form'),
    API.getter<RetentionSettings<string>>('admin/retentionSettings')
  ])

  const baseSchema = schemaResult.ok?.data ?? {}
  const { enabled: _enabled, schedule, ...restSchema } = baseSchema

  schema.value = Object.assign({}, { scheduler: buildSchedulerSchema(schedule) }, restSchema, {
    buttons: {
      type: 'group',
      schema: { submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } } }
    }
  })

  if (retentionSettingsResult.ok) {
    loadRetentionSettings(retentionSettingsResult.ok.data)
  }
})
</script>
