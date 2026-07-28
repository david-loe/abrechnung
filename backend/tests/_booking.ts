import { type BookingExportRow, type ReportModelName } from 'abrechnung-common/types.js'
import { roundAmount, sumAmounts } from 'abrechnung-common/utils/scripts.js'
import type { ExecutionContext } from 'ava'

export function assertBookingsBalanced(t: ExecutionContext, bookings: BookingExportRow[], reportModelName: ReportModelName) {
  t.true(bookings.length > 0)
  const balances = new Map<string, number>()
  for (const booking of bookings) {
    t.true(booking.amount > 0)
    t.true(booking.side === 'debit' || booking.side === 'credit')
    t.true(booking.remark?.startsWith(`${reportModelName} `) ?? false)
    const projectId = booking.project._id.toString()
    const signedAmount = booking.side === 'debit' ? booking.amount : -booking.amount
    balances.set(projectId, roundAmount(sumAmounts(balances.get(projectId) ?? 0, signedAmount)))
  }
  t.deepEqual(
    Array.from(balances.values()),
    Array.from(balances.values(), () => 0)
  )
}
