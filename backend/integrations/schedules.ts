import { Schedule } from 'abrechnung-common/types.js'
import { type RepeatOptions } from 'bullmq'

function isIntInRange(value: unknown, min: number, max: number) {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max
}

export function isValidSchedule(value: unknown): value is Schedule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const schedule = value as Partial<Schedule> & { [key: string]: unknown }

  if (schedule.type === 'everyXHour') {
    return isIntInRange(schedule.value, 1, 23)
  }

  if (schedule.type === 'daily') {
    return isIntInRange(schedule.hour, 0, 23) && isIntInRange(schedule.minute, 0, 59)
  }

  if (schedule.type === 'weekly') {
    if (!Array.isArray(schedule.weekdays) || schedule.weekdays.length === 0) {
      return false
    }
    const weekdays = schedule.weekdays.map(Number)
    return (
      weekdays.every((weekday, index) => isIntInRange(weekday, 0, 6) && weekdays.indexOf(weekday) === index) &&
      isIntInRange(schedule.hour, 0, 23) &&
      isIntInRange(schedule.minute, 0, 59)
    )
  }

  return false
}

export function scheduleToCronTime(schedule: Schedule) {
  if (schedule.type === 'everyXHour') {
    return `0 */${schedule.value} * * *`
  }
  if (schedule.type === 'daily') {
    return `${schedule.minute} ${schedule.hour} * * *`
  }
  return `${schedule.minute} ${schedule.hour} * * ${schedule.weekdays.join(',')}`
}

export function scheduleToRepeatOptions(schedule: Schedule): Omit<RepeatOptions, 'key'> {
  return { pattern: scheduleToCronTime(schedule) }
}
