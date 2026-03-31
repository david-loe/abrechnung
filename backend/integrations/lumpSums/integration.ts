import { Integration } from '../integration.js'

class LumpSumsIntegration extends Integration {
  public override readonly scheduledActions = [
    {
      scheduleKey: 'sync',
      defaultSchedule: { type: 'daily', hour: 1, minute: 0 } as const,
      enabledByDefault: true,
      description: 'lump sum sync',
      operation: 'sync',
      execute: async () => {
        const { syncLumpSums } = await import('./sync.js')
        await syncLumpSums()
      }
    }
  ]

  public constructor() {
    super('lumpSums')
  }
}

export const lumpSumsIntegration = new LumpSumsIntegration()

export async function runLumpSumsSchedule() {
  await lumpSumsIntegration.runScheduledAction('sync')
}
