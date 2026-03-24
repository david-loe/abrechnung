import test from 'ava'
import { isValidSchedule, scheduleToCronTime } from '../../integrations/schedules.js'

test('isValidSchedule validates the supported schedule variants', (t) => {
  t.true(isValidSchedule({ type: 'everyXHour', value: 6 }))
  t.true(isValidSchedule({ type: 'daily', hour: 1, minute: 30 }))
  t.true(isValidSchedule({ type: 'weekly', weekdays: [1, 3, 5], hour: 2, minute: 15 }))

  t.false(isValidSchedule({ type: 'everyXHour', value: 0 }))
  t.false(isValidSchedule({ type: 'everyXHour', value: 24 }))
  t.false(isValidSchedule({ type: 'daily', hour: 24, minute: 0 }))
  t.false(isValidSchedule({ type: 'weekly', weekdays: [], hour: 2, minute: 15 }))
  t.false(isValidSchedule({ type: 'weekly', weekdays: [1, 1], hour: 2, minute: 15 }))
  t.false(isValidSchedule({ type: 'weekly', weekdays: [7], hour: 2, minute: 15 }))
})

test('scheduleToCronTime converts structured schedules to cron expressions', (t) => {
  t.is(scheduleToCronTime({ type: 'everyXHour', value: 6 }), '0 */6 * * *')
  t.is(scheduleToCronTime({ type: 'daily', hour: 1, minute: 30 }), '30 1 * * *')
  t.is(scheduleToCronTime({ type: 'weekly', weekdays: [1, 3, 5], hour: 2, minute: 15 }), '15 2 * * 1,3,5')
})
