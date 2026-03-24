import { RetentionSettings } from 'abrechnung-common/types.js'
import test from 'ava'
import { shutdown } from '../../app.js'
import RetentionSettingsModel from '../../models/retentionSettings.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'admin')

test.serial('GET /admin/retentionSettings returns default retention settings', async (t) => {
  await RetentionSettingsModel.deleteMany({})
  const res = await agent.get('/admin/retentionSettings')

  t.is(res.status, 200)
  t.is(res.body.data.enabled, true)
  t.deepEqual(res.body.data.schedule, { type: 'daily', hour: 1, minute: 0 })
  t.is(res.body.data.retentionPolicy.mailXDaysBeforeDeletion, 7)
})

test.serial('GET /admin/retentionSettings/form returns a Vueform schema', async (t) => {
  const res = await agent.get('/admin/retentionSettings/form')

  t.is(res.status, 200)
  t.is(res.body.data.enabled.type, 'checkbox')
  t.is(res.body.data.schedule.type, 'schedule')
  t.is(res.body.data.retentionPolicy.type, 'object')
  t.is(res.body.data.retentionPolicy.schema.mailXDaysBeforeDeletion.inputType, 'number')
})

test.serial('POST /admin/retentionSettings persists schedule and policy together', async (t) => {
  await RetentionSettingsModel.deleteMany({})
  const settings: RetentionSettings = {
    _id: '' as never,
    enabled: false,
    schedule: { type: 'weekly', weekdays: [2, 4], hour: 5, minute: 30 },
    retentionPolicy: {
      deleteApprovedTravelAfterXDaysUnused: 11,
      deleteInWorkReportsAfterXDaysUnused: 12,
      deleteBookedAfterXDays: 13,
      mailXDaysBeforeDeletion: 4
    }
  }

  const postRes = await agent.post('/admin/retentionSettings').send(settings)

  t.is(postRes.status, 200)
  t.is(postRes.body.result.enabled, false)
  t.deepEqual(postRes.body.result.schedule, { type: 'weekly', weekdays: [2, 4], hour: 5, minute: 30 })
  t.deepEqual(postRes.body.result.retentionPolicy, settings.retentionPolicy)

  const stored = await RetentionSettingsModel.findOne({}, { __v: 0 }).lean()
  t.false(stored?.enabled ?? true)
  t.deepEqual(stored?.schedule, { type: 'weekly', weekdays: [2, 4], hour: 5, minute: 30 })
  t.deepEqual(stored?.retentionPolicy, settings.retentionPolicy)
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
