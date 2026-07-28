import test from 'ava'
import { Types } from 'mongoose'
import { getEmployeeLiabilityProjectAmounts } from '../controller/bookingExport.js'

const organisationA = new Types.ObjectId()
const organisationB = new Types.ObjectId()
const projectA1 = new Types.ObjectId()
const projectA2 = new Types.ObjectId()
const projectB = new Types.ObjectId()
const liabilityA = new Types.ObjectId()
const liabilityB = new Types.ObjectId()
const expenseAccount = new Types.ObjectId()
const organisations = new Map([
  [organisationA.toString(), { accountingSettings: { employeeLiabilitiesAccount: liabilityA } }],
  [organisationB.toString(), { accountingSettings: { employeeLiabilitiesAccount: liabilityB } }]
])

function booking(
  side: 'debit' | 'credit',
  amount: number,
  ledgerAccount: Types.ObjectId,
  project: Types.ObjectId,
  organisation: Types.ObjectId
) {
  return {
    side,
    amount,
    ledgerAccount: { _id: ledgerAccount, identifier: 'test', name: 'Test account' },
    project: { _id: project, identifier: 'test', organisation }
  }
}

test('derives remaining employee payments by organisation and project', (t) => {
  const result = getEmployeeLiabilityProjectAmounts(
    [
      booking('debit', 100, expenseAccount, projectA1, organisationA),
      booking('credit', 25, liabilityA, projectA1, organisationA),
      booking('credit', 35, liabilityA, projectA2, organisationA),
      booking('credit', 40, liabilityB, projectB, organisationB),
      booking('credit', 50, expenseAccount, projectA1, organisationA)
    ],
    organisations as never
  )
  t.deepEqual(Array.from(result.get(organisationA.toString())?.entries() ?? []), [
    [projectA1.toString(), 25],
    [projectA2.toString(), 35]
  ])
  t.deepEqual(Array.from(result.get(organisationB.toString())?.entries() ?? []), [[projectB.toString(), 40]])
})

test('fully advance-covered and negative reports have no employee payment', (t) => {
  const result = getEmployeeLiabilityProjectAmounts(
    [booking('credit', 100, expenseAccount, projectA1, organisationA), booking('debit', 100, liabilityA, projectA1, organisationA)],
    organisations as never
  )
  t.is(result.size, 0)
})

test('a half-covered report pays only the remaining employee liability', (t) => {
  const result = getEmployeeLiabilityProjectAmounts(
    [
      booking('debit', 100, expenseAccount, projectA1, organisationA),
      booking('credit', 50, expenseAccount, projectA1, organisationA),
      booking('credit', 50, liabilityA, projectA1, organisationA)
    ],
    organisations as never
  )
  t.deepEqual(Array.from(result.get(organisationA.toString())?.values() ?? []), [50])
})
