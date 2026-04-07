import { type Integration } from './integration.js'
import { lumpSumsIntegration } from './lumpSums/integration.js'
import { a1NotificationIntegration } from './notifications/a1.js'
import { mailNotificationIntegration } from './notifications/email.js'
import { pushNotificationIntegration } from './notifications/push.js'
import { statusNotificationIntegration } from './notifications/status.js'
import { reportDiskIntegration } from './reports/disk.js'
import { reportMailIntegration } from './reports/email.js'
import { retentionPolicyIntegration } from './retentionPolicy/integration.js'
import { webhookIntegration } from './webhooks/integration.js'

export const integrations: Integration[] = [
  lumpSumsIntegration,
  retentionPolicyIntegration,
  webhookIntegration,
  statusNotificationIntegration,
  reportMailIntegration,
  reportDiskIntegration,
  a1NotificationIntegration,
  mailNotificationIntegration,
  pushNotificationIntegration
]

export function getIntegration(integrationKey: string) {
  return integrations.find((integration) => integration.key === integrationKey)
}
