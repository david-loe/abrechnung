import test from 'ava'
import createAgent, { loginUser, shutdown } from '../_agent.js'
import { queueFixture } from '../_queue.js'

const agent = await createAgent()
await loginUser(agent, 'admin')
const retentionSettings = {
  deleteApprovedTravelAfterXDaysUnused: 0,
  deleteInWorkReportsAfterXDaysUnused: 0,
  deleteBookedAfterXDays: 0,
  mailXDaysBeforeDeletion: 7
}

test.serial('given enabled integration schedules, saving settings persists their cron jobs in Redis', async (t) => {
  const queue = queueFixture(t)
  await agent
    .post('/admin/integrationSettings/lumpSums')
    .send({ integrationKey: 'lumpSums', schedules: { sync: { enabled: true, schedule: { type: 'everyXHour', value: 6 } } }, settings: {} })
    .expect(200)
  await agent
    .post('/admin/integrationSettings/retentionPolicy')
    .send({
      integrationKey: 'retentionPolicy',
      schedules: { apply: { enabled: true, schedule: { type: 'weekly', weekdays: [1, 3], hour: 2, minute: 15 } } },
      settings: retentionSettings
    })
    .expect(200)
  const schedulers = await queue.getJobSchedulers()
  t.deepEqual(
    schedulers.map(({ key, name, pattern }) => ({ key, name, pattern })).sort((a, b) => a.key.localeCompare(b.key)),
    [
      { key: 'schedule:lumpSums:sync', name: 'lumpSums.sync', pattern: '0 */6 * * *' },
      { key: 'schedule:retentionPolicy:apply', name: 'retentionPolicy.apply', pattern: '15 2 * * 1,3' }
    ]
  )
  const jobs = await queue.getJobs(['delayed', 'waiting'])
  t.true(jobs.some(({ data }) => data.integrationKey === 'lumpSums' && data.operation === 'sync' && data.payload === null))
  t.true(jobs.some(({ data }) => data.integrationKey === 'retentionPolicy' && data.operation === 'apply' && data.payload === null))
  const lumpSums = jobs.find(({ name }) => name === 'lumpSums.sync')
  t.is(lumpSums?.opts.attempts, 3)
  t.deepEqual(lumpSums?.opts.backoff, { type: 'exponential', delay: 5000 })
})

test.serial(
  'given disabled and obsolete integration schedules, saving settings removes them and preserves unrelated schedulers',
  async (t) => {
    const queue = queueFixture(t)
    for (const key of ['schedule:lumpSums:sync', 'schedule:retentionPolicy:apply', 'schedule:legacy:orphan', 'other:scheduler']) {
      await queue.upsertJobScheduler(
        key,
        { pattern: '0 1 * * *' },
        { name: key, data: { integrationKey: 'example', operation: 'run', payload: null } }
      )
    }
    await agent
      .post('/admin/integrationSettings/lumpSums')
      .send({
        integrationKey: 'lumpSums',
        schedules: { sync: { enabled: true, schedule: { type: 'daily', hour: 1, minute: 0 } } },
        settings: {}
      })
      .expect(200)
    await agent
      .post('/admin/integrationSettings/retentionPolicy')
      .send({
        integrationKey: 'retentionPolicy',
        schedules: { apply: { enabled: false, schedule: { type: 'daily', hour: 1, minute: 0 } } },
        settings: retentionSettings
      })
      .expect(200)
    t.deepEqual((await queue.getJobSchedulers()).map(({ key }) => key).sort(), ['other:scheduler', 'schedule:lumpSums:sync'])
  }
)

test.after.always(async () => {
  await shutdown()
})
