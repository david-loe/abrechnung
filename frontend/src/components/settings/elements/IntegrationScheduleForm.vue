<template>
  <div v-if="form" class="card">
    <div class="card-body">
      <div class="form-check form-switch mb-4">
        <input
          :id="`${integrationKey}-${scheduleKey}-enabled`"
          v-model="form.schedules[scheduleKey].enabled"
          class="form-check-input"
          type="checkbox" >
        <label class="form-check-label" :for="`${integrationKey}-${scheduleKey}-enabled`">{{ t('labels.enabled') }}</label>
      </div>

      <div class="row g-3">
        <div class="col-md-4">
          <label :for="`${integrationKey}-${scheduleKey}-type`" class="form-label">{{ t('labels.schedule') }}</label>
          <select
            :id="`${integrationKey}-${scheduleKey}-type`"
            :value="form.schedules[scheduleKey].schedule.type"
            class="form-select"
            @change="updateScheduleType(($event.target as HTMLSelectElement).value as Schedule['type'])">
            <option value="everyXHour">{{ t('labels.everyXHour') }}</option>
            <option value="daily">{{ t('labels.daily') }}</option>
            <option value="weekly">{{ t('labels.weekly') }}</option>
          </select>
        </div>

        <div v-if="form.schedules[scheduleKey].schedule.type === 'everyXHour'" class="col-md-4">
          <label :for="`${integrationKey}-${scheduleKey}-value`" class="form-label">{{ t('labels.everyXHour') }}</label>
          <input
            :id="`${integrationKey}-${scheduleKey}-value`"
            v-model.number="everyXHourSchedule!.value"
            class="form-control"
            type="number"
            min="1"
            max="23" >
        </div>

        <template v-else>
          <div class="col-md-4">
            <label :for="`${integrationKey}-${scheduleKey}-hour`" class="form-label">{{ t('labels.hour') }}</label>
            <input
              :id="`${integrationKey}-${scheduleKey}-hour`"
              v-model.number="timedSchedule!.hour"
              class="form-control"
              type="number"
              min="0"
              max="23" >
          </div>

          <div class="col-md-4">
            <label :for="`${integrationKey}-${scheduleKey}-minute`" class="form-label">{{ t('labels.minute') }}</label>
            <input
              :id="`${integrationKey}-${scheduleKey}-minute`"
              v-model.number="timedSchedule!.minute"
              class="form-control"
              type="number"
              min="0"
              max="59" >
          </div>
        </template>

        <div v-if="form.schedules[scheduleKey].schedule.type === 'weekly'" class="col-12">
          <label class="form-label">{{ t('labels.weekdays') }}</label>
          <div class="d-flex flex-wrap gap-2">
            <div v-for="weekday in weekdays" :key="weekday" class="form-check">
              <input
                :id="`${integrationKey}-${scheduleKey}-weekday-${weekday}`"
                :checked="weeklySchedule!.weekdays.includes(weekday)"
                class="form-check-input"
                type="checkbox"
                @change="toggleWeekday(weekday, ($event.target as HTMLInputElement).checked)" >
              <label class="form-check-label" :for="`${integrationKey}-${scheduleKey}-weekday-${weekday}`">
                {{ t(`weekdaysShort.${weekday}`) }}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4">
        <button class="btn btn-primary" type="button" :disabled="isSaving" @click="save">{{ t('labels.save') }}</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { IntegrationSettings, Schedule } from 'abrechnung-common/types.js'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'

const props = defineProps<{ integrationKey: string; scheduleKey: string }>()

const { t } = useI18n()
const weekdays = [0, 1, 2, 3, 4, 5, 6] as const
const form = ref<IntegrationSettings<string> | null>(null)
const isSaving = ref(false)

const currentSchedule = computed(() => form.value?.schedules[props.scheduleKey].schedule)
const everyXHourSchedule = computed(() => (currentSchedule.value?.type === 'everyXHour' ? currentSchedule.value : null))
const timedSchedule = computed(() =>
  currentSchedule.value?.type === 'daily' || currentSchedule.value?.type === 'weekly' ? currentSchedule.value : null
)
const weeklySchedule = computed(() => (currentSchedule.value?.type === 'weekly' ? currentSchedule.value : null))

function buildSchedule(type: Schedule['type'], currentSchedule?: Schedule): Schedule {
  if (type === 'everyXHour') {
    return { type, value: currentSchedule?.type === 'everyXHour' ? currentSchedule.value : 1 }
  }

  if (type === 'daily') {
    return {
      type,
      hour: currentSchedule?.type === 'everyXHour' ? 1 : (currentSchedule?.hour ?? 1),
      minute: currentSchedule?.type === 'everyXHour' ? 0 : (currentSchedule?.minute ?? 0)
    }
  }

  return {
    type,
    weekdays: currentSchedule?.type === 'weekly' ? [...currentSchedule.weekdays] : [1],
    hour: currentSchedule?.type === 'everyXHour' ? 1 : (currentSchedule?.hour ?? 1),
    minute: currentSchedule?.type === 'everyXHour' ? 0 : (currentSchedule?.minute ?? 0)
  }
}

function updateScheduleType(type: Schedule['type']) {
  if (!form.value) {
    return
  }
  form.value.schedules[props.scheduleKey].schedule = buildSchedule(type, form.value.schedules[props.scheduleKey].schedule)
}

function toggleWeekday(weekday: number, checked: boolean) {
  if (!form.value) {
    return
  }

  const schedule = form.value.schedules[props.scheduleKey].schedule
  if (schedule.type !== 'weekly') {
    return
  }

  if (checked) {
    schedule.weekdays = [...new Set([...schedule.weekdays, weekday])].sort((a, b) => a - b)
  } else {
    schedule.weekdays = schedule.weekdays.filter((value) => value !== weekday)
  }
}

async function loadSettings() {
  const result = await API.getter<IntegrationSettings<string>>(`admin/integrationSettings/${props.integrationKey}`)
  if (result.ok) {
    form.value = result.ok.data
  }
}

async function save() {
  if (!form.value) {
    return
  }

  isSaving.value = true
  const result = await API.setter<IntegrationSettings<string>>(`admin/integrationSettings/${props.integrationKey}`, form.value)
  isSaving.value = false

  if (result.ok) {
    form.value = result.ok
  }
}

onMounted(loadSettings)
</script>
