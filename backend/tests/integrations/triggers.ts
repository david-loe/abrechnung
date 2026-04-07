import test, { ExecutionContext } from 'ava'
import { type Queue } from 'bullmq'
import { connectDB, disconnectDB } from '../../db.js'
import { closeIntegrationQueue, type IntegrationJobData, setIntegrationQueueForTests } from '../../integrations/queue.js'
import { syncIntegrationSchedules } from '../../integrations/scheduler.js'
import IntegrationSettingsModel from '../../models/integrationSettings.js'

await connectDB()

function stubQueue(
  t: ExecutionContext,
  options: {
    existingSchedulers?: Array<{ key: string; name: string }>
    onUpsert?: (jobSchedulerId: string, repeatOpts: unknown, jobTemplate?: unknown) => Promise<unknown>
    onRemove?: (jobSchedulerId: string) => Promise<boolean>
  } = {}
) {
  const removedSchedulers: string[] = []
  const upserts: Array<{ jobSchedulerId: string; repeatOpts: unknown; jobTemplate?: unknown }> = []

  setIntegrationQueueForTests({
    add: async () => ({}) as never,
    close: async () => {},
    getJob: async () => undefined,
    getJobSchedulers: async () => (options.existingSchedulers ?? []) as never,
    removeJobScheduler: async (jobSchedulerId: string) => {
      removedSchedulers.push(jobSchedulerId)
      return options.onRemove ? await options.onRemove(jobSchedulerId) : true
    },
    upsertJobScheduler: async (jobSchedulerId: string, repeatOpts: unknown, jobTemplate: unknown) => {
      upserts.push({ jobSchedulerId, repeatOpts, jobTemplate })
      return options.onUpsert ? ((await options.onUpsert(jobSchedulerId, repeatOpts, jobTemplate)) as never) : ({} as never)
    }
  } as unknown as Queue<IntegrationJobData>)

  t.teardown(() => {
    setIntegrationQueueForTests(undefined)
  })

  return { removedSchedulers, upserts }
}

test.after.always(async () => {
  await closeIntegrationQueue()
  await disconnectDB()
})

test.serial('syncIntegrationSchedules upserts repeatable jobs for enabled integration schedules', async (t) => {
  await IntegrationSettingsModel.findOneAndUpdate(
    { integrationKey: 'lumpSums' },
    { integrationKey: 'lumpSums', schedules: { sync: { enabled: true, schedule: { type: 'everyXHour', value: 6 } } }, settings: {} },
    { upsert: true, returnDocument: 'after', runValidators: true }
  )
  await IntegrationSettingsModel.findOneAndUpdate(
    { integrationKey: 'retentionPolicy' },
    {
      integrationKey: 'retentionPolicy',
      schedules: { apply: { enabled: true, schedule: { type: 'weekly', weekdays: [1, 3], hour: 2, minute: 15 } } },
      settings: {
        deleteApprovedTravelAfterXDaysUnused: 0,
        deleteInWorkReportsAfterXDaysUnused: 0,
        deleteBookedAfterXDays: 0,
        mailXDaysBeforeDeletion: 7
      }
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  )

  const { upserts, removedSchedulers } = stubQueue(t)

  await syncIntegrationSchedules()

  t.deepEqual(removedSchedulers, [])
  t.deepEqual(upserts, [
    {
      jobSchedulerId: 'schedule:lumpSums:sync',
      repeatOpts: { pattern: '0 */6 * * *' },
      jobTemplate: {
        name: 'lumpSums.sync',
        data: { integrationKey: 'lumpSums', operation: 'sync', payload: null },
        opts: { removeOnComplete: true, removeOnFail: true }
      }
    },
    {
      jobSchedulerId: 'schedule:retentionPolicy:apply',
      repeatOpts: { pattern: '15 2 * * 1,3' },
      jobTemplate: {
        name: 'retentionPolicy.apply',
        data: { integrationKey: 'retentionPolicy', operation: 'apply', payload: null },
        opts: { removeOnComplete: true, removeOnFail: true }
      }
    }
  ])
})

test.serial('syncIntegrationSchedules removes disabled and obsolete repeatable jobs', async (t) => {
  await IntegrationSettingsModel.findOneAndUpdate(
    { integrationKey: 'lumpSums' },
    { integrationKey: 'lumpSums', schedules: { sync: { enabled: true, schedule: { type: 'daily', hour: 1, minute: 0 } } }, settings: {} },
    { upsert: true, returnDocument: 'after', runValidators: true }
  )
  await IntegrationSettingsModel.findOneAndUpdate(
    { integrationKey: 'retentionPolicy' },
    {
      integrationKey: 'retentionPolicy',
      schedules: { apply: { enabled: false, schedule: { type: 'daily', hour: 1, minute: 0 } } },
      settings: {
        deleteApprovedTravelAfterXDaysUnused: 0,
        deleteInWorkReportsAfterXDaysUnused: 0,
        deleteBookedAfterXDays: 0,
        mailXDaysBeforeDeletion: 7
      }
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  )

  const { upserts, removedSchedulers } = stubQueue(t, {
    existingSchedulers: [
      { key: 'schedule:lumpSums:sync', name: 'lumpSums.sync' },
      { key: 'schedule:retentionPolicy:apply', name: 'retentionPolicy.apply' },
      { key: 'schedule:legacy:orphan', name: 'legacy.orphan' },
      { key: 'other:scheduler', name: 'other.scheduler' }
    ]
  })

  await syncIntegrationSchedules()

  t.deepEqual(upserts, [
    {
      jobSchedulerId: 'schedule:lumpSums:sync',
      repeatOpts: { pattern: '0 1 * * *' },
      jobTemplate: {
        name: 'lumpSums.sync',
        data: { integrationKey: 'lumpSums', operation: 'sync', payload: null },
        opts: { removeOnComplete: true, removeOnFail: true }
      }
    }
  ])
  t.deepEqual(removedSchedulers, ['schedule:retentionPolicy:apply', 'schedule:legacy:orphan'])
})
