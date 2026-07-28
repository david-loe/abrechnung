import { type BookingExportPackage, type BookingExportRow, type ReportModelName } from 'abrechnung-common/types.js'
import { roundAmount, sumAmounts } from 'abrechnung-common/utils/scripts.js'
import type { ExecutionContext } from 'ava'
import { Types } from 'mongoose'
import request from 'supertest'
import LedgerAccount from '../models/ledgerAccount.js'
import Organisation from '../models/organisation.js'
import User from '../models/user.js'

export async function requestBookingExport(
  agent: request.Agent,
  endpoint: string,
  reports: unknown[],
  options: { includeBankBookings?: boolean } = {}
) {
  const bankLedgerAccount = options.includeBankBookings
    ? await LedgerAccount.findOneAndUpdate(
        { identifier: '1200' },
        { $setOnInsert: { identifier: '1200', name: 'Bank' } },
        { upsert: true, returnDocument: 'after' }
      ).lean()
    : undefined
  await Promise.all([
    User.updateMany(
      {},
      { $set: { 'settings.bankAccount': { accountHolder: 'Test Employee', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' } } }
    ),
    Organisation.updateMany(
      {},
      {
        $set: {
          'accountingSettings.includeBankBookings': Boolean(options.includeBankBookings),
          'accountingSettings.payoutAccounts': [
            {
              _id: new Types.ObjectId(),
              name: 'Test payout account',
              accountHolder: 'Test Organisation',
              iban: 'DE75512108001245126199',
              bic: 'SOGEDEFFXXX',
              ...(bankLedgerAccount ? { ledgerAccount: bankLedgerAccount._id } : {})
            }
          ]
        }
      }
    )
  ])
  const previewResponse = await agent.post(`${endpoint}/bookingExportPreview`).send(reports)
  if (previewResponse.status !== 200) return previewResponse
  const bankAccounts = previewResponse.body.result.organisations.map(({ _id, accounts }: { _id: string; accounts: { _id: string }[] }) => ({
    organisation: _id,
    account: accounts[0]._id
  }))
  return (await agent
    .post(`${endpoint}/bookingExportPackage`)
    .send({ reports, executionDate: '2026-08-01', bankAccounts })) as request.Response & { body: { result: BookingExportPackage } }
}

export function assertBookingsBalanced(t: ExecutionContext, bookings: BookingExportRow[], reportModelName: ReportModelName) {
  t.true(bookings.length > 0)
  const balances = new Map<string, number>()
  for (const booking of bookings) {
    t.true(booking.amount > 0)
    t.true(booking.side === 'debit' || booking.side === 'credit')
    t.true(Boolean(booking.remark?.startsWith(`${reportModelName} `) || booking.remark?.startsWith('SEPA ')))
    const projectId = booking.project._id.toString()
    const signedAmount = booking.side === 'debit' ? booking.amount : -booking.amount
    balances.set(projectId, roundAmount(sumAmounts(balances.get(projectId) ?? 0, signedAmount)))
  }
  t.deepEqual(
    Array.from(balances.values()),
    Array.from(balances.values(), () => 0)
  )
}
