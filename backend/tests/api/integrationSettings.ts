import { IntegrationSettings } from 'abrechnung-common/types.js'
import test from 'ava'
import { shutdown } from '../../app.js'
import IntegrationSettingsModel from '../../models/integrationSettings.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'admin')

test.serial('GET /admin/integrationSettings/lumpSums returns the default schedule configuration', async (t) => {
  await IntegrationSettingsModel.deleteOne({ integrationKey: 'lumpSums' })
  const res = await agent.get('/admin/integrationSettings/lumpSums')

  t.is(res.status, 200)
  t.deepEqual(res.body.data.schedules.sync, { enabled: true, schedule: { type: 'daily', hour: 1, minute: 0 } })
})

test.serial('POST /admin/integrationSettings/lumpSums persists updated schedule settings', async (t) => {
  await IntegrationSettingsModel.deleteOne({ integrationKey: 'lumpSums' })
  const settings: IntegrationSettings = {
    _id: '' as never,
    integrationKey: 'lumpSums',
    schedules: { sync: { enabled: true, schedule: { type: 'everyXHour', value: 6 } } }
  }

  const postRes = await agent.post('/admin/integrationSettings/lumpSums').send(settings)

  t.is(postRes.status, 200)
  t.deepEqual(postRes.body.result.schedules.sync, { enabled: true, schedule: { type: 'everyXHour', value: 6 } })

  const stored = await IntegrationSettingsModel.findOne({ integrationKey: 'lumpSums' }, { __v: 0 }).lean()
  const storedSchedules = stored?.schedules as { sync?: unknown } | Map<string, unknown> | undefined
  const storedSchedule = storedSchedules instanceof Map ? storedSchedules.get('sync') : storedSchedules?.sync
  t.deepEqual(storedSchedule, { enabled: true, schedule: { type: 'everyXHour', value: 6 } })
})

test.serial('POST /admin/integrationSettings/retentionPolicy persists weekly schedules', async (t) => {
  await IntegrationSettingsModel.deleteOne({ integrationKey: 'retentionPolicy' })
  const settings: IntegrationSettings = {
    _id: '' as never,
    integrationKey: 'retentionPolicy',
    schedules: { apply: { enabled: true, schedule: { type: 'weekly', weekdays: [1, 3], hour: 2, minute: 15 } } }
  }

  const postRes = await agent.post('/admin/integrationSettings/retentionPolicy').send(settings)

  t.is(postRes.status, 200)
  t.deepEqual(postRes.body.result.schedules.apply, { enabled: true, schedule: { type: 'weekly', weekdays: [1, 3], hour: 2, minute: 15 } })
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
