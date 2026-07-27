import { AdvanceState, ExpenseReportState, TravelState } from 'abrechnung-common/types.js'
import test from 'ava'
import { Types } from 'mongoose'
import { getOwnerReportRoute } from '../../integrations/notifications/statusLinks.js'

test('rejected travel owner notifications link to the HomePage travel modal', (t) => {
  const reportId = new Types.ObjectId()

  t.is(getOwnerReportRoute('travel', reportId, TravelState.REJECTED), `/user/travel/${reportId}`)
})

test('rejected advance owner notifications link to the existing HomePage advance route', (t) => {
  const reportId = new Types.ObjectId()

  t.is(getOwnerReportRoute('advance', reportId, AdvanceState.REJECTED), `/advance/${reportId}`)
})

test('non-rejected reports keep their detail routes', (t) => {
  const reportId = new Types.ObjectId()

  t.is(getOwnerReportRoute('travel', reportId, TravelState.APPROVED), `/travel/${reportId}`)
  t.is(getOwnerReportRoute('expenseReport', reportId, ExpenseReportState.REVIEW_COMPLETED), `/expenseReport/${reportId}`)
})
