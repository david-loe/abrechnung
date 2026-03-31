import { Integration } from '../integration.js'

class RetentionPolicyIntegration extends Integration {
  public override readonly scheduledActions = [
    {
      scheduleKey: 'apply',
      defaultSchedule: { type: 'daily', hour: 1, minute: 0 } as const,
      enabledByDefault: true,
      description: 'retention policy run',
      operation: 'apply',
      execute: async () => {
        const { applyRetentionPolicy } = await import('../../retentionpolicy.js')
        await applyRetentionPolicy()
      }
    }
  ]

  public constructor() {
    super('retentionPolicy')
  }
}

export const retentionPolicyIntegration = new RetentionPolicyIntegration()

export async function runRetentionPolicySchedule() {
  await retentionPolicyIntegration.runScheduledAction('apply')
}
