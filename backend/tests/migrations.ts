import displaySettings from 'abrechnung-common/data/displaySettings.js'
import { Cost, State, travelExpenseItems } from 'abrechnung-common/types.js'
import test, { type ExecutionContext } from 'ava'
import mongoose, { Types } from 'mongoose'
import settings from '../data/settings.js'
import { initDB } from '../db.js'
import ENV from '../env.js'
import { checkForMigrations } from '../migrations.js'
import '../models/category.js'
import { getCostPositionValidationIssues } from '../models/helper.js'
import '../models/organisation.js'
import '../models/project.js'

const databaseName = `abrechnung-migrations-${new Types.ObjectId()}`
const mongoUrl = new URL(ENV.MONGO_URL)
mongoUrl.pathname = `/${databaseName}`

test.serial.before(async () => {
  await mongoose.connect(mongoUrl.toString())
})

test.serial.beforeEach(async () => {
  await mongoose.connection.dropDatabase()
})

function assertBalancedBookings(t: ExecutionContext, bookings: unknown[]) {
  t.true(bookings.length > 0)
  const balance = bookings.reduce<number>((sum, booking) => {
    const { side, amount } = booking as { side: 'debit' | 'credit'; amount: number }
    return sum + (side === 'debit' ? amount : -amount)
  }, 0)
  t.is(balance, 0)
}

test.serial('v2.6.4 migration initializes accounting settings and legacy categories before creating bookings', async (t) => {
  const organisationId = new Types.ObjectId()
  const projectId = new Types.ObjectId()
  const categoryId = new Types.ObjectId()
  const userId = new Types.ObjectId()
  const bookingDate = new Date('2026-07-01T00:00:00.000Z')
  const reportBase = {
    historic: false,
    state: State.BOOKABLE,
    project: projectId,
    owner: userId,
    log: { [State.BOOKABLE]: { on: bookingDate, by: userId } }
  }

  await Promise.all([
    mongoose.connection.collection('settings').insertOne({ ...settings, migrateFrom: '2.6.4' }),
    mongoose.connection.collection('displaysettings').insertOne(displaySettings),
    mongoose.connection.collection('organisations').insertOne({ _id: organisationId, name: 'Legacy organisation' }),
    mongoose.connection
      .collection('projects')
      .insertOne({ _id: projectId, identifier: '001', name: 'Legacy project', organisation: organisationId }),
    mongoose.connection
      .collection('categories')
      .insertOne({ _id: categoryId, name: 'Legacy category', isDefault: true, style: { color: '#D8DCFF', text: 'black' } }),
    mongoose.connection.collection('users').insertOne({ _id: userId, name: { givenName: 'Philip', familyName: 'Fry' } }),
    mongoose.connection
      .collection('advances')
      .insertOne({ _id: new Types.ObjectId(), ...reportBase, reference: 1, budget: { amount: 100, currency: 'EUR' } }),
    mongoose.connection
      .collection('expensereports')
      .insertOne({
        _id: new Types.ObjectId(),
        ...reportBase,
        reference: 2,
        category: categoryId,
        addUp: [{ project: projectId, advance: { amount: 0 } }],
        expenses: [
          { description: 'Office supplies', project: projectId, cost: { amount: 25, currency: 'EUR', receipts: [], date: bookingDate } }
        ]
      }),
    mongoose.connection
      .collection('travels')
      .insertOne({
        _id: new Types.ObjectId(),
        ...reportBase,
        reference: 3,
        professionalShare: null,
        addUp: [{ project: projectId, advance: { amount: 0 } }],
        expenses: [],
        days: [],
        stages: [
          {
            project: projectId,
            transport: { type: 'ownCar', distance: 10, distanceRefundType: 'car' },
            purpose: 'professional',
            cost: { amount: 15, currency: 'EUR', receipts: [] }
          }
        ]
      })
  ])

  await checkForMigrations()

  const ledgerAccounts = await mongoose.connection.collection('ledgeraccounts').find().toArray()
  const accountsByIdentifier = new Map(ledgerAccounts.map((account) => [account.identifier, account]))
  const organisation = await mongoose.connection.collection('organisations').findOne({ _id: organisationId })
  t.true(organisation?.accountingSettings.employeeLiabilitiesAccount.equals(accountsByIdentifier.get('1740')?._id))
  t.true(organisation?.accountingSettings.employeeClaimsAccount.equals(accountsByIdentifier.get('1530')?._id))
  t.false(organisation?.accountingSettings.vatAccountingEnabled)
  t.false(organisation?.accountingSettings.includeBankBookings)
  t.deepEqual(organisation?.accountingSettings.payoutAccounts, [])
  for (const item of travelExpenseItems) {
    t.true(organisation?.accountingSettings.accountMapping[item].equals(accountsByIdentifier.get('4660')?._id))
  }

  const category = await mongoose.connection.collection('categories').findOne({ _id: categoryId })
  t.is(category?.for, 'ExpenseReport')
  t.true(category?.ledgerAccount.equals(accountsByIdentifier.get('4900')?._id))

  const expenseReport = await mongoose.connection.collection('expensereports').findOne({ reference: 2 })
  const expensePosition = expenseReport?.expenses[0].cost.positions[0]
  t.true(expensePosition.category.equals(categoryId))
  t.deepEqual(
    await getCostPositionValidationIssues([expenseReport?.expenses[0].cost] as Cost<Types.ObjectId>[], 'ExpenseReport', true, false),
    []
  )

  const advance = await mongoose.connection.collection('advances').findOne({ reference: 1 })
  const travel = await mongoose.connection.collection('travels').findOne({ reference: 3 })
  assertBalancedBookings(t, advance?.bookings ?? [])
  assertBalancedBookings(t, expenseReport?.bookings ?? [])
  assertBalancedBookings(t, travel?.bookings ?? [])
})

test.serial('fresh database seeds separate default categories for expense and travel reports', async (t) => {
  await initDB()

  const categories = await mongoose.connection.collection('categories').find().toArray()
  const ledgerAccounts = await mongoose.connection.collection('ledgeraccounts').find().toArray()
  const accountsByIdentifier = new Map(ledgerAccounts.map((account) => [account.identifier, account]))
  const expenseCategory = categories.find(({ for: categoryFor }) => categoryFor === 'ExpenseReport')
  const travelCategory = categories.find(({ for: categoryFor }) => categoryFor === 'Travel')

  t.is(categories.length, 2)
  t.is(expenseCategory?.name, 'General')
  t.true(expenseCategory?.isDefault)
  t.true(expenseCategory?.ledgerAccount.equals(accountsByIdentifier.get('4900')?._id))
  t.is(travelCategory?.name, 'Travel expenses')
  t.true(travelCategory?.isDefault)
  t.true(travelCategory?.ledgerAccount.equals(accountsByIdentifier.get('4660')?._id))
})

test.serial.after.always(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
