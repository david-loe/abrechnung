<template>
  <Vueform
    :schema="schema"
    ref="form"
    :endpoint="false"
    @submit="(form$: any) => save(form$.requestData)"
    @keydown.ctrl.s.prevent="(event: KeyboardEvent) => { event.repeat ? null : save((formRef?.requestData ?? {}) as any) }" />
</template>

<script lang="ts" setup>
import { VueformSchema } from '@vueform/vueform'
import { IntegrationScheduleSettings, IntegrationSettings } from 'abrechnung-common/types.js'
import { onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'

const props = defineProps<{ integrationKey: string }>()
type IntegrationSettingsPayload = Omit<IntegrationSettings<string>, '_id'>

const { t } = useI18n()
const schema = ref({})
const integrationSettings = ref<IntegrationSettingsPayload | null>(null)
const scheduleKey = ref<string | undefined>(undefined)

const formRef = useTemplateRef('form')

function getScheduleSettings(requestData: Record<string, unknown>) {
  if (typeof requestData.enabled !== 'boolean' || !requestData.schedule || typeof requestData.schedule !== 'object') {
    return undefined
  }

  return {
    enabled: requestData.enabled,
    schedule: requestData.schedule as IntegrationScheduleSettings['schedule']
  } satisfies IntegrationScheduleSettings
}

function buildSchedulerSchema(
  scheduleSchema: VueformSchema | undefined,
  defaultValue: IntegrationScheduleSettings | undefined
): VueformSchema {
  return {
    ...(scheduleSchema ?? {}),
    type: 'schedule',
    ...(defaultValue ? { default: defaultValue } : {}),
    addClasses: {
      ...((scheduleSchema?.addClasses as object | undefined) ?? {}),
      ElementLabel: { wrapper: 'h5' },
      ElementLayout: { container: 'mb-2' }
    }
  }
}

async function fetchSettings() {
  const [schemaResult, settingsResult] = await Promise.all([
    API.getter<{ [key: string]: VueformSchema }>(`admin/integrationSettings/${props.integrationKey}/form`),
    API.getter<IntegrationSettingsPayload>(`admin/integrationSettings/${props.integrationKey}`)
  ])

  const baseSchema = { ...(schemaResult.ok?.data ?? {}) }
  const { enabled: _enabled, schedule: rawSchedule, ...restSchema } = baseSchema
  const scheduleSchemaSource = rawSchedule && typeof rawSchedule === 'object' ? (rawSchedule as Record<string, unknown>) : undefined
  const resolvedScheduleKey = typeof scheduleSchemaSource?.scheduleKey === 'string' ? scheduleSchemaSource.scheduleKey : undefined
  const scheduleSchema = scheduleSchemaSource
    ? ((({ scheduleKey: _scheduleKey, ...rest }) => rest)(scheduleSchemaSource) as VueformSchema)
    : undefined
  const storedSettings = settingsResult.ok?.data
  scheduleKey.value = resolvedScheduleKey
  const schemaWithDefaults = Object.fromEntries(
    Object.entries(restSchema).map(([key, fieldSchema]) => [
      key,
      {
        ...(fieldSchema as Record<string, unknown>),
        ...(storedSettings?.settings[key] !== undefined ? { default: storedSettings.settings[key] } : {})
      }
    ])
  )

  schema.value = Object.assign(
    {},
    resolvedScheduleKey ? { scheduler: buildSchedulerSchema(scheduleSchema, storedSettings?.schedules[resolvedScheduleKey]) } : {},
    schemaWithDefaults,
    {
      buttons: {
        type: 'group',
        schema: { submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } } }
      }
    }
  )

  if (settingsResult.ok) {
    integrationSettings.value = settingsResult.ok.data
  }
}

async function save(requestData: Record<string, unknown>) {
  if (!integrationSettings.value) {
    return
  }

  const scheduleSettings = scheduleKey.value ? getScheduleSettings(requestData) : undefined
  const { enabled: _enabled, schedule: _schedule, ...nextSettings } = requestData

  const result = await API.setter<IntegrationSettingsPayload>(`admin/integrationSettings/${props.integrationKey}`, {
    ...integrationSettings.value,
    schedules: scheduleKey.value
      ? { ...integrationSettings.value.schedules, ...(scheduleSettings ? { [scheduleKey.value]: scheduleSettings } : {}) }
      : integrationSettings.value.schedules,
    settings: { ...integrationSettings.value.settings, ...nextSettings }
  })

  if (result.ok) {
    integrationSettings.value = result.ok
  }
}

onMounted(fetchSettings)
</script>
