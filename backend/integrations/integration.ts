import { Schedule } from 'abrechnung-common/types.js'
import { JobsOptions } from 'bullmq'
import { type IntegrationEvent } from './events.js'
import { getIntegrationQueue } from './queue.js'
import { runScheduledIntegrationJob } from './runScheduledIntegrationJob.js'

export interface IntegrationScheduledActionDefinition {
  scheduleKey: string
  defaultSchedule: Schedule
  enabledByDefault: boolean
  description: string
  operation: string
  execute: (payload: unknown) => Promise<void>
  buildPayload?: () => Promise<unknown> | unknown
  jobOptions?: JobsOptions
}

export class Integration {
  public readonly scheduledActions: IntegrationScheduledActionDefinition[] = []

  public constructor(public readonly key: string) {}

  protected getJobOptions(_operation: string): JobsOptions {
    return {}
  }

  protected buildJobName(operation: string) {
    return `${this.key}.${operation}`
  }

  protected buildScheduledJobId(scheduleKey: string) {
    return `schedule:${this.key}:${scheduleKey}`
  }

  protected getScheduledAction(scheduleKey: string) {
    return this.scheduledActions.find((scheduledAction) => scheduledAction.scheduleKey === scheduleKey)
  }

  protected getScheduledActionForOperation(operation: string) {
    return this.scheduledActions.find((scheduledAction) => scheduledAction.operation === operation)
  }

  public async enqueue(operation: string, payload: unknown, jobOptions: JobsOptions = {}) {
    await getIntegrationQueue().add(
      this.buildJobName(operation),
      { integrationKey: this.key, operation, payload },
      { ...this.getJobOptions(operation), ...jobOptions }
    )
  }

  public async runScheduledAction(scheduleKey: string) {
    const action = this.getScheduledAction(scheduleKey)
    if (!action) {
      throw new Error(`No schedule '${scheduleKey}' found for integration '${this.key}'.`)
    }

    const jobId = this.buildScheduledJobId(scheduleKey)
    await runScheduledIntegrationJob(jobId, action.description, async () => {
      const payload = action.buildPayload ? await action.buildPayload() : {}
      await this.enqueue(action.operation, payload, { jobId, removeOnComplete: true, removeOnFail: true, ...action.jobOptions })
    })
  }

  public handles(_event: IntegrationEvent) {
    return false
  }

  public async runEvent(_event: IntegrationEvent) {}

  public async execute(operation: string, payload: unknown) {
    const scheduledAction = this.getScheduledActionForOperation(operation)
    if (scheduledAction) {
      await scheduledAction.execute(payload)
      return
    }

    throw new Error(`Integration '${this.key}' does not support operation '${operation}'.`)
  }
}
