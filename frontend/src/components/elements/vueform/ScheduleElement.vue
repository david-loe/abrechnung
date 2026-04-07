<template>
  <component :is="elementLayout" :multiple="true" class="schedule-element" ref="container">
    <template #element>
      <div class="row g-3">
        <div class="col-12">
          <component :is="component(detailFields.enabled)" v-bind="detailFields.enabled" name="enabled" />
        </div>

        <component :is="component(hiddenField)" v-bind="hiddenField" name="type" />

        <div class="col-md-4">
          <label :for="`${fieldId}-type`" class="vf-label vf-col-12 vf-vertical-label">{{ $t('labels.frequency') }}</label>
          <Multiselect
            :id="`${fieldId}-type`"
            :modelValue="normalizedValue.type"
            :options="scheduleTypeOptions"
            valueProp="value"
            label="label"
            mode="single"
            :searchable="false"
            :canDeselect="false"
            :canClear="false"
            :classes="selectClasses"
            :disabled="isScheduleDisabled"
            :locale="form$.locale$"
            @update:modelValue="setScheduleType"
            ref="input" />
        </div>

        <div v-if="normalizedValue.type === 'everyXHour'" class="col-md-4">
          <component :is="component(detailFields.value)" v-bind="detailFields.value" name="value" />
        </div>

        <div v-else class="col-md-8">
          <component :is="component(detailFields.time)" v-bind="detailFields.time" name="time" />
        </div>

        <div v-if="normalizedValue.type === 'weekly'" class="col-12">
          <component :is="component(detailFields.weekdays)" v-bind="detailFields.weekdays" name="weekdays" />
        </div>
      </div>
    </template>

    <template v-for="(component, slot) in elementSlots" #[slot]>
      <slot :name="slot" :el$="el$">
        <component :is="component" :el$="el$" />
      </slot>
    </template>
  </component>
</template>

<script>
import Multiselect from '@vueform/multiselect/src/Multiselect.vue'
import { ObjectElement, defineElement } from '@vueform/vueform'
import { SelectElement as SelectElementTemplate } from '@vueform/vueform/dist/bootstrap'

const weekdays = [0, 1, 2, 3, 4, 5, 6]
const defaultHour = 1
const defaultMinute = 0

function normalizeLoadedValue(value) {
  if (value?.type) {
    return { enabled: value.enabled ?? true, ...value }
  }

  if (value?.schedule && typeof value.schedule === 'object') {
    return { enabled: value.enabled ?? true, ...value.schedule }
  }

  return { enabled: true }
}

function getTimedScheduleParts(schedule) {
  return {
    hour: Number.isInteger(schedule?.hour) ? schedule.hour : defaultHour,
    minute: Number.isInteger(schedule?.minute) ? schedule.minute : defaultMinute
  }
}

function formatTimeValue(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function parseTimeValue(timeValue) {
  if (typeof timeValue !== 'string') {
    return null
  }

  const match = /^(\d{2}):(\d{2})$/.exec(timeValue)

  if (!match) {
    return null
  }

  const hour = Number(match[1])
  const minute = Number(match[2])

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  return { hour, minute }
}

function buildScheduleRequestData(value) {
  if (value?.type === 'everyXHour') {
    return { type: value.type, value: value.value }
  }

  const { hour, minute } = parseTimeValue(value?.time) || getTimedScheduleParts(value)

  if (value?.type === 'daily') {
    return { type: value.type, hour, minute }
  }

  return {
    type: value?.type ?? 'daily',
    weekdays: Array.isArray(value?.weekdays) && value.weekdays.length > 0 ? value.weekdays : [1],
    hour,
    minute
  }
}

function formatScheduleRequestData(_name, value) {
  return { enabled: value?.enabled ?? true, schedule: buildScheduleRequestData(value) }
}

export default defineElement({
  ...ObjectElement,
  name: 'ScheduleElement',
  components: { Multiselect },
  props: Object.assign({}, ObjectElement.props, {
    formatData: { type: Function, default: formatScheduleRequestData },
    formatLoad: { type: Function, default: normalizeLoadedValue }
  }),
  data() {
    return {
      weekdays,
      scheduleTypeOptions: [
        { value: 'everyXHour', label: this.$t('labels.everyXHour') },
        { value: 'daily', label: this.$t('labels.daily') },
        { value: 'weekly', label: this.$t('labels.weekly') }
      ],
      weekdayItems: weekdays.map((weekday) => ({ value: weekday, label: this.$t(`weekdaysShort.${weekday}`) })),
      selectClasses: { ...SelectElementTemplate.data().defaultClasses.select }
    }
  },
  computed: {
    isScheduleDisabled() {
      return this.isDisabled || !this.normalizedValue.enabled
    },
    hiddenField() {
      return { type: 'hidden', default: this.normalizedValue.type }
    },
    detailFields() {
      return {
        enabled: { type: 'checkbox', default: this.normalizedValue.enabled, text: this.$t('labels.enabled'), disabled: this.isDisabled },
        value: {
          type: 'text',
          default: this.normalizedValue.value,
          inputType: 'number',
          forceNumbers: true,
          label: this.$t('labels.everyXHour'),
          disabled: this.isScheduleDisabled,
          attrs: { min: 1, max: 23 }
        },
        time: {
          type: 'date',
          default: this.formatTimeValue(this.normalizedValue.hour, this.normalizedValue.minute),
          date: false,
          time: true,
          hour24: true,
          valueFormat: 'HH:mm',
          loadFormat: 'HH:mm',
          displayFormat: 'HH:mm',
          label: this.$t('labels.time'),
          disabled: this.isScheduleDisabled,
          onChange: this.handleTimeChange
        },
        weekdays: {
          type: 'checkboxgroup',
          default: this.normalizedValue.weekdays,
          items: this.weekdayItems,
          disabled: this.isScheduleDisabled,
          onChange: this.handleWeekdaysChange,
          label: this.$t('labels.weekdays')
        }
      }
    },
    normalizedValue() {
      return this.buildValue(this.value)
    }
  },
  mounted() {
    if (!this.value?.type && !this.value?.schedule?.type) {
      this.update(this.normalizedValue)
    }
  },
  methods: {
    formatTimeValue,
    buildValue(currentValue) {
      const normalizedValue = normalizeLoadedValue(currentValue)

      return { enabled: normalizedValue.enabled ?? true, ...this.buildSchedule(normalizedValue.type || 'daily', normalizedValue) }
    },
    buildSchedule(type, currentSchedule) {
      if (type === 'everyXHour') {
        return { type, value: currentSchedule?.type === 'everyXHour' ? currentSchedule.value : 1 }
      }

      const { hour, minute } = getTimedScheduleParts(currentSchedule?.type === 'everyXHour' ? null : currentSchedule)

      if (type === 'daily') {
        return { type, hour, minute }
      }

      return {
        type,
        weekdays:
          currentSchedule?.type === 'weekly' && Array.isArray(currentSchedule.weekdays) && currentSchedule.weekdays.length > 0
            ? [...currentSchedule.weekdays]
            : [1],
        hour,
        minute
      }
    },
    setScheduleType(type) {
      this.update({ enabled: this.normalizedValue.enabled, ...this.buildSchedule(type, this.normalizedValue) })
    },
    handleTimeChange(nextTimeValue, previousTimeValue) {
      if (this.normalizedValue.type === 'everyXHour' || !this.normalizedValue.enabled) {
        return
      }

      const nextTime = parseTimeValue(nextTimeValue) || parseTimeValue(previousTimeValue)

      if (!nextTime) {
        this.update(this.normalizedValue)
        return
      }

      this.update({ ...this.normalizedValue, hour: nextTime.hour, minute: nextTime.minute })
    },
    handleWeekdaysChange(nextWeekdays = [], previousWeekdays = []) {
      if (this.normalizedValue.type !== 'weekly') {
        return
      }

      if (nextWeekdays.length === 0 && previousWeekdays.length === 1) {
        this.update({ ...this.normalizedValue, weekdays: previousWeekdays })
        return
      }

      this.update({ ...this.normalizedValue, weekdays: [...new Set(nextWeekdays)].sort((a, b) => a - b) })
    }
  }
})
</script>

<style>
.schedule-element .vf-checkboxgroup-wrapper[aria-labelledby$=".weekdays__label"] {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.schedule-element .vf-checkboxgroup-wrapper[aria-labelledby$=".weekdays__label"] .vf-checkbox-container {
  display: inline-flex;
  width: auto;
  align-items: center;
  margin-bottom: 0;
}
</style>
