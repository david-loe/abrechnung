<template>
  <Vueform
    :schema="schema"
    ref="form"
    :endpoint="false"
    @submit="(form$: any) => save(form$.requestData)"
    @keydown.ctrl.s.prevent="(e: KeyboardEvent) => { e.repeat ? null : save((formRef?.requestData ?? {}) as any) }" />
</template>

<script lang="ts" setup>
import { VueformElement, VueformSchema } from '@vueform/vueform'
import { IntegrationScheduleSettings, IntegrationSettings } from 'abrechnung-common/types.js'
import { onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'

const props = defineProps<{ integrationKey: string; scheduleKey: string }>()
type IntegrationSettingsPayload = Omit<IntegrationSettings<string>, '_id'>

const { t } = useI18n()
const schema = ref({})
const integrationSettings = ref<IntegrationSettingsPayload | null>(null)

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

function loadScheduleSettings(scheduleSettings: IntegrationScheduleSettings) {
  queueMicrotask(() => {
    const form = formRef.value as VueformElement | null
    form?.load({ scheduler: scheduleSettings }, true)
  })
}

async function loadSettings() {
  const [schemaResult, settingsResult] = await Promise.all([
    API.getter<{ [key: string]: VueformSchema }>(`admin/integrationSettings/${props.integrationKey}/form/${props.scheduleKey}`),
    API.getter<IntegrationSettingsPayload>(`admin/integrationSettings/${props.integrationKey}`)
  ])

  const { enabled: _enabled, schedule, ...restSchema } = schemaResult.ok?.data ?? {}

  schema.value = Object.assign({}, { scheduler: buildSchedulerSchema(schedule) }, restSchema, {
    buttons: {
      type: 'group',
      schema: { submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } } }
    }
  })

  if (settingsResult.ok) {
    integrationSettings.value = settingsResult.ok.data
    loadScheduleSettings(settingsResult.ok.data.schedules[props.scheduleKey])
  }
}

async function save(scheduleSettings: IntegrationScheduleSettings) {
  if (!integrationSettings.value) {
    return
  }

  const result = await API.setter<IntegrationSettingsPayload>(`admin/integrationSettings/${props.integrationKey}`, {
    ...integrationSettings.value,
    schedules: { ...integrationSettings.value.schedules, [props.scheduleKey]: scheduleSettings }
  })

  if (result.ok) {
    integrationSettings.value = result.ok
    loadScheduleSettings(result.ok.schedules[props.scheduleKey])
  }
}

onMounted(loadSettings)
</script>
