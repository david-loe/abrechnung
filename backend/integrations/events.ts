import { Advance, ExpenseReport, HealthCareCost, Travel } from 'abrechnung-common/types.js'

type ReportEventTarget = Travel | ExpenseReport | HealthCareCost | Advance
type TravelEventTarget = Travel
type ReviewableReportTarget = ReportEventTarget

export type IntegrationEvent =
  | { type: 'report.draft_saved'; report: ReportEventTarget }
  | { type: 'report.submitted'; report: ReportEventTarget }
  | { type: 'report.review_requested'; report: ReportEventTarget }
  | { type: 'report.rejected'; report: ReportEventTarget }
  | { type: 'report.back_to_in_work'; report: ReportEventTarget }
  | { type: 'report.review_completed'; report: ReviewableReportTarget }
  | { type: 'travel.directly_approved'; report: TravelEventTarget }
  | { type: 'travel.approved'; report: TravelEventTarget }
  | { type: 'travel.back_to_approved'; report: TravelEventTarget }
  | { type: 'advance.received'; report: Advance }

export interface EventIntegration {
  handles(event: IntegrationEvent): boolean
  runEvent(event: IntegrationEvent): Promise<void>
}

export async function emitIntegrationEvent(event: IntegrationEvent, integrations: EventIntegration[]) {
  for (const integration of integrations) {
    if (integration.handles(event)) {
      await integration.runEvent(event)
    }
  }
}
