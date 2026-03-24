import { Advance, Contact, ExpenseReport, HealthCareCost, User as IUser, Locale, Travel } from 'abrechnung-common/types.js'
import { Types } from 'mongoose'

export type IntegrationReport =
  | Travel<Types.ObjectId>
  | ExpenseReport<Types.ObjectId>
  | HealthCareCost<Types.ObjectId>
  | Advance<Types.ObjectId>

export type IntegrationMailRecipient = Contact & { fk: IUser['fk']; settings: { language: IUser['settings']['language'] } }

export const outboundActionTypes = [
  'webhooks.deliver',
  'notifications.email.send',
  'notifications.push.send',
  'reports.email.send',
  'reports.write_disk'
] as const
export type OutboundActionType = (typeof outboundActionTypes)[number]

export const inboundSyncTypes = ['lump_sums.sync_in'] as const
export type InboundSyncType = (typeof inboundSyncTypes)[number]

export const policyActionTypes = ['retention.apply'] as const
export type PolicyActionType = (typeof policyActionTypes)[number]

export interface NotificationEmailPayload {
  recipient: IntegrationMailRecipient
  subject: string
  paragraph: string
  language: Locale
  button?: { text: string; link: string }
  lastParagraph?: string | string[]
}

export interface NotificationPushPayload {
  title: string
  body: string
  users: IUser<Types.ObjectId>[]
  url: string
}

export interface ReportEmailPayload {
  report: IntegrationReport
}

export interface ReportWriteDiskPayload {
  filePath: string
  report: IntegrationReport
}

export interface WebhookDeliveryPayload {
  report: IntegrationReport
}

export interface OutboundActionPayloadMap {
  'webhooks.deliver': WebhookDeliveryPayload
  'notifications.email.send': NotificationEmailPayload
  'notifications.push.send': NotificationPushPayload
  'reports.email.send': ReportEmailPayload
  'reports.write_disk': ReportWriteDiskPayload
}

export interface InboundSyncPayloadMap {
  'lump_sums.sync_in': Record<string, never>
}

export interface PolicyActionPayloadMap {
  'retention.apply': Record<string, never>
}

export type IntegrationJobData =
  | { contract: 'outboundAction'; action: OutboundActionType; payload: OutboundActionPayloadMap[OutboundActionType] }
  | { contract: 'inboundSync'; action: InboundSyncType; payload: InboundSyncPayloadMap[InboundSyncType] }
  | { contract: 'policy'; action: PolicyActionType; payload: PolicyActionPayloadMap[PolicyActionType] }
