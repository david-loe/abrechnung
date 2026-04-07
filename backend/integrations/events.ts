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

export type IntegrationEventByType<TType extends IntegrationEvent['type']> = Extract<IntegrationEvent, { type: TType }>

export type IntegrationEventHandlerMap = {
  [TType in IntegrationEvent['type']]: (event: IntegrationEventByType<TType>) => Promise<void>
}

export interface EventIntegration {
  events: Partial<IntegrationEventHandlerMap>
}

export async function emitIntegrationEvent<TType extends IntegrationEvent['type']>(
  event: IntegrationEventByType<TType>,
  integrations: EventIntegration[]
) {
  for (const integration of integrations) {
    const handler = integration.events[event.type]
    if (handler) {
      await handler(event)
    }
  }
}
