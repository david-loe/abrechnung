import test from 'ava'
import { shutdown } from '../../app.js'
import { IntegrationSettingsPayload } from '../../integrations/settings.js'
import IntegrationSettingsModel from '../../models/integrationSettings.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'admin')

type NewIntegrationSettings = IntegrationSettingsPayload

test.serial('GET /admin/integrationSettings/lumpSums returns the stored schedule configuration', async (t) => {
  const res = await agent.get('/admin/integrationSettings/lumpSums')
  const lumpSumsSettings = res.body.data
  t.is(res.status, 200)
  t.is(lumpSumsSettings.integrationKey, 'lumpSums')
  t.true(typeof lumpSumsSettings.schedules.sync.enabled === 'boolean')
  t.deepEqual(lumpSumsSettings.settings, {})
})

test.serial('POST /admin/integrationSettings/lumpSums persists updated schedule settings', async (t) => {
  const settings: NewIntegrationSettings = {
    integrationKey: 'lumpSums',
    schedules: { sync: { enabled: true, schedule: { type: 'everyXHour', value: 6 } } },
    settings: {}
  }

  const postRes = await agent.post('/admin/integrationSettings/lumpSums').send(settings)

  t.is(postRes.status, 200)
  t.deepEqual(postRes.body.result, settings)

  const stored = await IntegrationSettingsModel.findOne({ integrationKey: 'lumpSums' }, { __v: 0 }).lean()
  t.deepEqual(stored?.schedules, { sync: { enabled: true, schedule: { type: 'everyXHour', value: 6 } } })
  t.deepEqual(stored?.settings, {})
})

test.serial('GET /admin/integrationSettings/retentionPolicy/form returns the combined retention schema', async (t) => {
  const res = await agent.get('/admin/integrationSettings/retentionPolicy/form')

  t.is(res.status, 200)
  t.is(res.body.data.schedule.type, 'schedule')
  t.is(res.body.data.schedule.scheduleKey, 'apply')
  t.is(res.body.data.mailXDaysBeforeDeletion.inputType, 'number')
})

test.serial('POST /admin/integrationSettings/retentionPolicy persists schedule and retention settings together', async (t) => {
  const settings: NewIntegrationSettings = {
    integrationKey: 'retentionPolicy',
    schedules: { apply: { enabled: false, schedule: { type: 'weekly', weekdays: [2, 4], hour: 5, minute: 30 } } },
    settings: {
      deleteApprovedTravelAfterXDaysUnused: 11,
      deleteInWorkReportsAfterXDaysUnused: 12,
      deleteBookedAfterXDays: 13,
      mailXDaysBeforeDeletion: 4
    }
  }

  const postRes = await agent.post('/admin/integrationSettings/retentionPolicy').send(settings)

  t.is(postRes.status, 200)
  t.deepEqual(postRes.body.result, settings)

  const stored = await IntegrationSettingsModel.findOne({ integrationKey: 'retentionPolicy' }, { __v: 0 }).lean()
  t.deepEqual(stored?.schedules, { apply: { enabled: false, schedule: { type: 'weekly', weekdays: [2, 4], hour: 5, minute: 30 } } })
  t.deepEqual(stored?.settings, settings.settings)
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
