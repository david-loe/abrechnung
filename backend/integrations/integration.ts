import { Locale } from 'abrechnung-common/types.js'
import { JobsOptions } from 'bullmq'
import { type IntegrationEventHandlerMap } from './events.js'
import { getIntegrationQueue } from './queue.js'

export const INTEGRATION_SCHEDULE_PREFIX = 'schedule:'

export interface IntegrationOperationDefinition {
  // biome-ignore lint/suspicious/noExplicitAny: typing is too complex for now, can be improved in the future
  run: (payload: any) => Promise<void>
  buildPayload?: () => Promise<unknown> | unknown
  jobOptions?: JobsOptions
}

export class Integration {
  public readonly operations: Record<string, IntegrationOperationDefinition> = {}
  public readonly events: Partial<IntegrationEventHandlerMap> = {}

  public constructor(public readonly key: string) {}

  public buildJobName(operation: string) {
    return `${this.key}.${operation}`
  }

  public buildOperationSchedulerId(operation: string) {
    return `${INTEGRATION_SCHEDULE_PREFIX}${this.key}:${operation}`
  }

  public getSettingsFormSchema(_language: Locale | readonly Locale[]) {
    return {}
  }

  public getDefaultSettings() {
    return {}
  }

  public hasOperation(operation: string) {
    return operation in this.operations
  }

  public getOperationKeys() {
    return Object.keys(this.operations)
  }

  public requireOperation(operation: string) {
    const definition = this.operations[operation]
    if (!definition) {
      throw new Error(`No operation '${operation}' found for integration '${this.key}'.`)
    }

    return definition
  }

  public async enqueue(operation: string, payload: unknown, jobOptions: JobsOptions = {}) {
    const definition = this.requireOperation(operation)
    await getIntegrationQueue().add(
      this.buildJobName(operation),
      { integrationKey: this.key, operation, payload },
      { ...definition.jobOptions, ...jobOptions }
    )
  }

  /**
   * Operations without an explicit payload or buildPayload receive an empty object
   * so queue workers never pass undefined into run handlers.
   */
  public async runOperation(operation: string, payload: unknown) {
    const definition = this.requireOperation(operation)
    const resolvedPayload = payload ?? (await definition.buildPayload?.()) ?? {}
    await definition.run(resolvedPayload)
  }
}
