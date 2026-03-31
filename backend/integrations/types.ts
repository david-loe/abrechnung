import { Advance, Contact, ExpenseReport, HealthCareCost, User as IUser, Locale, Travel } from 'abrechnung-common/types.js'
import { Types } from 'mongoose'

export type IntegrationReport =
  | Travel<Types.ObjectId>
  | ExpenseReport<Types.ObjectId>
  | HealthCareCost<Types.ObjectId>
  | Advance<Types.ObjectId>

export type IntegrationMailRecipient = Contact & { fk: IUser['fk']; settings: { language: IUser['settings']['language'] } }

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

export interface IntegrationJobData {
  integrationKey: string
  operation: string
  payload: unknown
}
