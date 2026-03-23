<template>
  <ElementLayout>
    <template #element>
      <div class="row g-3">
        <div class="col-md-4">
          <label :for="`${fieldId}-type`" class="form-label">{{ $t('labels.schedule') }}</label>
          <select
            :id="`${fieldId}-type`"
            class="form-select"
            :disabled="isDisabled"
            :value="normalizedValue.type"
            @change="setScheduleTypeFromEvent">
            <option value="everyXHour">{{ $t('labels.everyXHour') }}</option>
            <option value="daily">{{ $t('labels.daily') }}</option>
            <option value="weekly">{{ $t('labels.weekly') }}</option>
          </select>
        </div>

        <div v-if="normalizedValue.type === 'everyXHour'" class="col-md-4">
          <label :for="`${fieldId}-value`" class="form-label">{{ $t('labels.everyXHour') }}</label>
          <input
            :id="`${fieldId}-value`"
            class="form-control"
            type="number"
            min="1"
            max="23"
            :disabled="isDisabled"
            :value="normalizedValue.value"
            @input="setEveryXHourFromEvent" >
        </div>

        <template v-else>
          <div class="col-md-4">
            <label :for="`${fieldId}-hour`" class="form-label">{{ $t('labels.hour') }}</label>
            <input
              :id="`${fieldId}-hour`"
              class="form-control"
              type="number"
              min="0"
              max="23"
              :disabled="isDisabled"
              :value="normalizedValue.hour"
              @input="setTimedPartFromEvent('hour', $event)" >
          </div>

          <div class="col-md-4">
            <label :for="`${fieldId}-minute`" class="form-label">{{ $t('labels.minute') }}</label>
            <input
              :id="`${fieldId}-minute`"
              class="form-control"
              type="number"
              min="0"
              max="59"
              :disabled="isDisabled"
              :value="normalizedValue.minute"
              @input="setTimedPartFromEvent('minute', $event)" >
          </div>
        </template>

        <div v-if="normalizedValue.type === 'weekly'" class="col-12">
          <label class="form-label">{{ $t('labels.weekdays') }}</label>
          <div class="d-flex flex-wrap gap-3">
            <div v-for="weekday in weekdays" :key="weekday" class="form-check">
              <input
                :id="`${fieldId}-weekday-${weekday}`"
                class="form-check-input"
                type="checkbox"
                :disabled="isDisabled"
                :checked="normalizedValue.weekdays.includes(weekday)"
                @change="toggleWeekdayFromEvent(weekday, $event)" >
              <label class="form-check-label" :for="`${fieldId}-weekday-${weekday}`">{{ $t(`weekdaysShort.${weekday}`) }}</label>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-for="(component, slot) in elementSlots" #[slot]>
      <slot :name="slot" :el$="el$">
        <component :is="component" :el$="el$" />
      </slot>
    </template>
  </ElementLayout>
</template>

<script>
import { defineElement } from '@vueform/vueform'

const weekdays = [0, 1, 2, 3, 4, 5, 6]

export default defineElement({
  name: 'ScheduleElement',
  data() {
    return { weekdays }
  },
  computed: {
    normalizedValue() {
      return this.buildSchedule(this.value?.type || 'daily', this.value)
    }
  },
  mounted() {
    if (!this.value?.type) {
      this.update(this.normalizedValue)
    }
  },
  methods: {
    buildSchedule(type, currentSchedule) {
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
    },
    setScheduleType(type) {
      this.update(this.buildSchedule(type, this.normalizedValue))
    },
    setScheduleTypeFromEvent(event) {
      this.setScheduleType(event.target.value)
    },
    setEveryXHour(value) {
      this.update({ ...this.normalizedValue, value: Number(value) })
    },
    setEveryXHourFromEvent(event) {
      this.setEveryXHour(event.target.value)
    },
    setTimedPart(key, value) {
      this.update({ ...this.normalizedValue, [key]: Number(value) })
    },
    setTimedPartFromEvent(key, event) {
      this.setTimedPart(key, event.target.value)
    },
    toggleWeekday(weekday, checked) {
      if (this.normalizedValue.type !== 'weekly') {
        return
      }

      const nextWeekdays = checked
        ? [...new Set([...this.normalizedValue.weekdays, weekday])].sort((a, b) => a - b)
        : this.normalizedValue.weekdays.filter((value) => value !== weekday)

      this.update({ ...this.normalizedValue, weekdays: nextWeekdays })
    },
    toggleWeekdayFromEvent(weekday, event) {
      this.toggleWeekday(weekday, event.target.checked)
    }
  }
})
</script>
