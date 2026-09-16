import { baseCurrency, ReportModelName, travelExpenseItems } from 'abrechnung-common/types.js'
import { divideAmount, multiplyAmountAndRound, roundAmount, subtractAmounts, sumAmounts } from 'abrechnung-common/utils/scripts.js'
import mongoose from 'mongoose'
import semver from 'semver'
import { logger } from './logger.js'
import Settings from './models/settings.js'

const reportCollections: Record<ReportModelName, string> = {
  Travel: 'travels',
  ExpenseReport: 'expensereports',
  HealthCareCost: 'healthcarecosts',
  Advance: 'advances'
}

export async function initializeReferenceCounters() {
  const counters = mongoose.connection.collection<{ _id: ReportModelName; value: number }>('referencecounters')

  await Promise.all(
    Object.entries(reportCollections).map(async ([modelName, collectionName]) => {
      const [reportWithHighestReference] = await mongoose.connection
        .collection<{ reference?: number; historic?: boolean }>(collectionName)
        .find({ historic: { $ne: true }, reference: { $exists: true } })
        .sort({ reference: -1 })
        .limit(1)
        .toArray()
      await counters.updateOne(
        { _id: modelName as ReportModelName },
        { $max: { value: reportWithHighestReference?.reference || 0 } },
        { upsert: true }
      )
    })
  )
}

export async function initializeUsersAndProjectsCreationAccess() {
  await Promise.all([
    mongoose.connection
      .collection('users')
      .updateMany({ 'access.create/usersAndProjects': { $exists: false } }, { $set: { 'access.create/usersAndProjects': false } }),
    mongoose.connection
      .collection('displaysettings')
      .updateMany(
        { 'accessIcons.create/usersAndProjects': { $exists: false } },
        { $set: { 'accessIcons.create/usersAndProjects': ['person-plus', 'folder-plus'] } }
      )
  ])
}

export function assertSupportedMigration(migrateFrom: string, targetVersion: string) {
  const minVersion = '2.6.3'
  if (semver.lt(migrateFrom, minVersion)) {
    throw new Error(`Migration from v${migrateFrom} to v${targetVersion} not supported. Migrate to v${minVersion} first.`)
  }
}

export async function checkForMigrations() {
  const settings = await Settings.findOne()
  if (settings?.migrateFrom) {
    const migrateFrom = settings.migrateFrom
    assertSupportedMigration(migrateFrom, settings.version)

    if (semver.lt(migrateFrom, '3.0.0')) {
      // Validate before changing any v3 report data. Each report is subsequently
      // converted atomically, so a retry can skip its already converted costs.
      for (const collectionName of ['travels', 'expensereports', 'healthcarecosts']) {
        for await (const report of mongoose.connection.collection(collectionName).find()) {
          for (const field of ['expenses', 'stages']) {
            for (const [index, entry] of (report[field] ?? []).entries()) {
              const cost = entry.cost
              if (!cost || Array.isArray(cost.positions) || cost.currency === baseCurrency._id) continue
              const location = `${collectionName}/${report._id}/${field}/${index}/cost`
              normalizeLegacyExchangeRate(cost.amount ?? 0, cost.exchangeRate, location)
              if (cost.amount && cost.exchangeRate?.amount == null) {
                logger.warn(`Preserving foreign cost without a recorded EUR amount: ${location}`)
              }
            }
          }
        }
      }
      for await (const advance of mongoose.connection.collection('advances').find({ 'balance.currency': { $exists: false } })) {
        if (advance.budget.currency === baseCurrency._id) continue
        const location = `advances/${advance._id}`
        const converted = convertLegacyAdvance(
          { budget: advance.budget, balance: advance.balance, offsetAgainst: advance.offsetAgainst },
          location
        )
        if (!converted.sourceBalanced) {
          logger.warn(`Preserving unmatched legacy advance totals without rounding adjustment: ${location}`)
        }
      }
      logger.info('Apply migration to v3.0.0: initialize atomic report reference counters')
      await initializeReferenceCounters()
      logger.info('Apply migration to v3.0.0: introduce cost positions and VAT settings')
      const ledgerAccounts = mongoose.connection.collection('ledgeraccounts')
      await Promise.all([
        ledgerAccounts.updateOne(
          { identifier: '1530' },
          { $setOnInsert: { identifier: '1530', name: 'Forderungen gegen Personal aus Lohn- und Gehaltsabrechnung' } },
          { upsert: true }
        ),
        ledgerAccounts.updateOne(
          { identifier: '1740' },
          { $setOnInsert: { identifier: '1740', name: 'Verbindlichkeiten aus Lohn und Gehalt' } },
          { upsert: true }
        ),
        ledgerAccounts.updateOne(
          { identifier: '1571' },
          { $setOnInsert: { identifier: '1571', name: 'Abziehbare Vorsteuer 7 %' } },
          { upsert: true }
        ),
        ledgerAccounts.updateOne(
          { identifier: '1576' },
          { $setOnInsert: { identifier: '1576', name: 'Abziehbare Vorsteuer 19 %' } },
          { upsert: true }
        ),
        ledgerAccounts.updateOne(
          { identifier: '4660' },
          { $setOnInsert: { identifier: '4660', name: 'Reisekosten Arbeitnehmer' } },
          { upsert: true }
        ),
        ledgerAccounts.updateOne(
          { identifier: '4900' },
          { $setOnInsert: { identifier: '4900', name: 'Sonstige betriebliche Aufwendungen' } },
          { upsert: true }
        )
      ])
      const [account1530, account1740, account1571, account1576, account4660, account4900] = await Promise.all(
        ['1530', '1740', '1571', '1576', '4660', '4900'].map((identifier) => ledgerAccounts.findOne({ identifier }))
      )
      if (!account1530 || !account1740 || !account1571 || !account1576 || !account4660 || !account4900) {
        throw new Error('Required default ledger accounts for the cost-position migration are missing')
      }

      const accountMapping = Object.fromEntries(travelExpenseItems.map((item) => [item, account4660._id]))

      const accountingDefaults = {
        employeeLiabilitiesAccount: account1740._id,
        employeeClaimsAccount: account1530._id,
        accountMapping,
        vatAccountingEnabled: false,
        includeBankBookings: false,
        payoutAccounts: [],
        vatRates: [{ rate: 0 }, { rate: 7, inputTaxAccount: account1571._id }, { rate: 19, inputTaxAccount: account1576._id }]
      }
      for (const [key, value] of Object.entries(accountingDefaults)) {
        const path = `accountingSettings.${key}`
        await mongoose.connection.collection('organisations').updateMany({ [path]: { $exists: false } }, { $set: { [path]: value } })
      }

      const categories = mongoose.connection.collection('categories')
      await Promise.all([
        categories.updateMany({ ledgerAccount: { $exists: false } }, { $set: { ledgerAccount: account4900._id } }),
        categories.updateMany({ for: { $exists: false } }, { $set: { for: 'ExpenseReport' } })
      ])

      async function ensureCategory(forType: 'Travel' | 'ExpenseReport', ledgerAccount: mongoose.Types.ObjectId, name: string) {
        const existing = await categories.findOne({ for: { $in: [forType, 'both'] }, ledgerAccount })
        if (existing) return existing._id
        const inserted = await categories.insertOne({
          name,
          ledgerAccount,
          for: forType,
          isDefault: false,
          style: { color: '#D8DCFF', text: 'black' }
        })
        return inserted.insertedId
      }

      const expenseDefault =
        (await categories.findOne({ for: { $in: ['ExpenseReport', 'both'] }, isDefault: true })) ??
        (await categories.findOne({ for: { $in: ['ExpenseReport', 'both'] } }))
      const expenseCategoryId = expenseDefault?._id ?? (await ensureCategory('ExpenseReport', account4900._id, 'General'))
      const travelDefault =
        (await categories.findOne({ for: { $in: ['Travel', 'both'] }, isDefault: true })) ??
        (await categories.findOne({ for: { $in: ['Travel', 'both'] } }))
      const travelCategoryId = travelDefault?._id ?? (await ensureCategory('Travel', account4660._id, 'Travel expenses'))

      const projects = mongoose.connection.collection('projects')
      const organisations = mongoose.connection.collection('organisations')
      const travelCategoryByAccount = new Map<string, mongoose.Types.ObjectId>()
      async function categoryForTravelStage(projectId: mongoose.Types.ObjectId, transportType: string) {
        const project = await projects.findOne({ _id: projectId })
        const organisation = project ? await organisations.findOne({ _id: project.organisation }) : null
        const account = organisation?.accountingSettings?.accountMapping?.[transportType]
        if (!account) return travelCategoryId
        const key = account.toString()
        if (!travelCategoryByAccount.has(key)) {
          const ledgerAccount = await ledgerAccounts.findOne({ _id: account })
          travelCategoryByAccount.set(
            key,
            await ensureCategory('Travel', account, ledgerAccount?.name ?? `Travel ${ledgerAccount?.identifier ?? ''}`.trim())
          )
        }
        return travelCategoryByAccount.get(key) as mongoose.Types.ObjectId
      }

      async function migrateReports(collectionName: 'travels' | 'expensereports' | 'healthcarecosts') {
        const collection = mongoose.connection.collection(collectionName)
        const cursor = collection.find()
        for await (const report of cursor) {
          const expenses = []
          for (const expense of report.expenses ?? []) {
            const cost = { ...expense.cost }
            const project = expense.project ?? report.project
            const category =
              collectionName === 'expensereports'
                ? (report.category ?? expenseCategoryId)
                : collectionName === 'travels'
                  ? travelCategoryId
                  : expenseCategoryId
            if (!Array.isArray(cost.positions)) {
              if (cost.currency !== baseCurrency._id) {
                cost.exchangeRate = normalizeLegacyExchangeRate(
                  cost.amount ?? 0,
                  cost.exchangeRate,
                  `${collectionName}/${report._id}/expenses/${expense._id}`
                )
              }
              cost.positions = [
                {
                  _id: new mongoose.Types.ObjectId(),
                  kind: 'manual',
                  description: expense.description,
                  grossAmount: typeof cost.amount === 'number' ? cost.amount : 0,
                  vatRate: 0,
                  project,
                  category
                }
              ]
            }
            delete cost.amount
            if (cost.exchangeRate) delete cost.exchangeRate.amount
            const migratedExpense = { ...expense, cost }
            delete migratedExpense.project
            expenses.push(migratedExpense)
          }

          const update: Record<string, unknown> = { expenses }
          if (report.addUp) update.addUp = migrateSummaries(report.addUp, report.project)
          if (collectionName === 'travels') {
            const stages = []
            for (const stage of report.stages ?? []) {
              const cost = { ...stage.cost }
              const project = stage.project ?? report.project
              if (!Array.isArray(cost.positions)) {
                if (cost.currency !== baseCurrency._id) {
                  cost.exchangeRate = normalizeLegacyExchangeRate(
                    cost.amount ?? 0,
                    cost.exchangeRate,
                    `travels/${report._id}/stages/${stage._id}`
                  )
                }
                const isOwnCar = stage.transport?.type === 'ownCar'
                const hasCost = isOwnCar || (typeof cost.amount === 'number' && cost.amount !== 0)
                cost.positions = hasCost
                  ? [
                      {
                        _id: new mongoose.Types.ObjectId(),
                        kind: isOwnCar ? 'ownCar' : 'manual',
                        ...(isOwnCar ? {} : { description: stage.transport?.type }),
                        grossAmount: typeof cost.amount === 'number' ? cost.amount : 0,
                        vatRate: 0,
                        project,
                        category: await categoryForTravelStage(project, stage.transport?.type)
                      }
                    ]
                  : []
              }
              delete cost.amount
              if (cost.exchangeRate) delete cost.exchangeRate.amount
              const migratedStage = { ...stage, cost }
              delete migratedStage.project
              stages.push(migratedStage)
            }
            update.stages = stages
          }
          await collection.updateOne(
            { _id: report._id },
            { $set: update, ...(collectionName === 'expensereports' ? { $unset: { category: '' } } : {}) }
          )
        }
      }

      await migrateReports('travels')
      await migrateReports('expensereports')
      await migrateReports('healthcarecosts')

      logger.info('Apply migration to v3.0.0: initialize SEPA payout settings')
      await mongoose.connection
        .collection('ledgeraccounts')
        .updateOne({ identifier: '1200' }, { $setOnInsert: { identifier: '1200', name: 'Bank' } }, { upsert: true })

      logger.info('Apply migration to v3.0.0: add user and project creation access')
      await initializeUsersAndProjectsCreationAccess()

      logger.info('Apply migration to v3.0.0: add expense report currencies and currency-aware advances')
      await ledgerAccounts.updateOne(
        { identifier: '2660' },
        { $setOnInsert: { identifier: '2660', name: 'Kursdifferenzen' } },
        { upsert: true }
      )
      const exchangeDifferencesAccount = await ledgerAccounts.findOne({ identifier: '2660' })
      if (!exchangeDifferencesAccount) throw new Error('Failed to initialize currency exchange differences account 2660')
      await mongoose.connection
        .collection('organisations')
        .updateMany(
          { 'accountingSettings.currencyExchangeDifferencesAccount': { $exists: false } },
          { $set: { 'accountingSettings.currencyExchangeDifferencesAccount': exchangeDifferencesAccount._id } }
        )

      await Promise.all(
        ['travels', 'expensereports', 'healthcarecosts'].map((collectionName) =>
          mongoose.connection
            .collection(collectionName)
            .updateMany(
              { addUp: { $elemMatch: { currency: { $exists: false } } } },
              { $set: { 'addUp.$[entry].currency': baseCurrency._id } },
              { arrayFilters: [{ 'entry.currency': { $exists: false } }] }
            )
        )
      )

      const advances = mongoose.connection.collection<{
        _id: mongoose.Types.ObjectId
        createdAt: Date
        budget: { amount: number; currency: string; exchangeRate?: { date: Date; rate: number; amount: number } | null }
        balance: { amount: number; currency?: string; exchangeRate?: { date: Date; rate: number; amount: number } | null }
        offsetAgainst: { amount: number; [key: string]: unknown }[]
      }>('advances')
      // The balance currency is written atomically with all converted amounts.
      // Its presence makes retries safe, including after a partial failure.
      for await (const advance of advances.find({ 'balance.currency': { $exists: false } })) {
        const currency = advance.budget.currency || baseCurrency._id
        const converted = currency === baseCurrency._id ? undefined : convertLegacyAdvance(advance, `advances/${advance._id}`)
        const normalizedRate = currency === baseCurrency._id ? advance.budget.exchangeRate : converted?.exchangeRate
        const exchangeRateFor = (amount: number) =>
          currency === baseCurrency._id || !normalizedRate ? null : { ...normalizedRate, amount }
        await advances.updateOne(
          { _id: advance._id, 'balance.currency': { $exists: false } },
          {
            $set: {
              ...(normalizedRate ? { 'budget.exchangeRate': normalizedRate } : {}),
              ...(currency !== baseCurrency._id ? { exchangeRateDate: advance.budget.exchangeRate?.date ?? advance.createdAt } : {}),
              balance: {
                amount: converted ? converted.balance : advance.balance.amount,
                currency,
                exchangeRate: exchangeRateFor(advance.balance.amount)
              },
              offsetAgainst: advance.offsetAgainst.map((offset, index) => ({
                ...offset,
                amount: converted ? converted.offsets[index] : offset.amount,
                currency,
                exchangeRate: exchangeRateFor(offset.amount)
              }))
            }
          }
        )
      }
    }
    settings.migrateFrom = undefined
    await settings.save()
  }
}

interface LegacyExchangeRate {
  rate: number
  amount?: number | null
  date?: unknown
}

// Old releases stored both rate directions. The recorded EUR amount is the
// financial source of truth; a rate alone cannot establish its direction.
function normalizeLegacyExchangeRate<T extends LegacyExchangeRate>(amount: number, exchangeRate: T | null | undefined, location: string) {
  if (exchangeRate?.amount == null) return exchangeRate
  const euroAmount = exchangeRate.amount
  if (!Number.isFinite(amount) || !Number.isFinite(euroAmount)) {
    throw new Error(`Invalid legacy currency amounts at ${location}`)
  }
  const reproducesEuroAmount = (rate: number) =>
    Number.isFinite(rate) && rate > 0 && multiplyAmountAndRound(amount, rate) === roundAmount(euroAmount)
  if (reproducesEuroAmount(exchangeRate.rate)) return exchangeRate
  const rate = divideAmount(euroAmount, amount)
  if (!reproducesEuroAmount(rate)) {
    throw new Error(`Cannot preserve legacy EUR amount at ${location}`)
  }
  return { ...exchangeRate, rate }
}

function convertLegacyAdvance<T extends LegacyExchangeRate>(
  advance: { budget: { amount: number; exchangeRate?: T | null }; balance: { amount: number }; offsetAgainst: { amount: number }[] },
  location: string
) {
  const exchangeRate = normalizeLegacyExchangeRate(advance.budget.amount, advance.budget.exchangeRate, `${location}/budget`)
  const euroAmounts = [advance.balance.amount, ...advance.offsetAgainst.map((offset) => offset.amount)]
  if (!euroAmounts.every(Number.isFinite)) throw new Error(`Invalid legacy advance amounts at ${location}`)
  const rate = exchangeRate?.rate
  if (euroAmounts.some((amount) => amount !== 0) && !(exchangeRate?.amount != null && rate && Number.isFinite(rate) && rate > 0)) {
    throw new Error(`Cannot migrate foreign-currency advance without recorded budget amounts at ${location}`)
  }

  const convert = (amount: number) => (rate ? roundAmount(divideAmount(amount, rate)) : 0)
  let balance = convert(advance.balance.amount)
  const offsets = advance.offsetAgainst.map((offset) => convert(offset.amount))
  const sourceBalanced = exchangeRate?.amount != null && roundAmount(sumAmounts(...euroAmounts)) === roundAmount(exchangeRate.amount)
  if (sourceBalanced) {
    const offsetSum = sumAmounts(...offsets)
    const difference = roundAmount(subtractAmounts(advance.budget.amount, sumAmounts(balance, offsetSum)))
    if (Math.abs(difference) > 0.01) throw new Error(`Legacy advance rounding difference exceeds 0.01 at ${location}`)
    if (difference !== 0) {
      // Keep a spent advance at zero; assign its rounding remainder to the last nonzero offset.
      if (advance.balance.amount !== 0) {
        balance = roundAmount(subtractAmounts(advance.budget.amount, offsetSum))
        if (balance < 0) throw new Error(`Legacy advance rounding would produce a negative balance at ${location}`)
      } else {
        let index = advance.offsetAgainst.length - 1
        while (index >= 0 && advance.offsetAgainst[index].amount === 0) index -= 1
        if (index < 0) throw new Error(`Legacy advance rounding has no offset to adjust at ${location}`)
        offsets[index] = roundAmount(sumAmounts(offsets[index], difference))
        if (offsets[index] < 0) throw new Error(`Legacy advance rounding would produce a negative offset at ${location}`)
      }
    }
  }
  return { exchangeRate, balance, offsets, sourceBalanced }
}

interface LegacySummary {
  project?: unknown
  currency?: unknown
  expenses: { amount: number }
  total: { amount: number }
  balance: { amount: number }
  advance?: { amount: number }
  lumpSums?: { amount: number }
  negativeTotal?: boolean
  advanceOverflow?: boolean
}

function migrateSummaries(summary: LegacySummary | LegacySummary[], project: unknown) {
  return (Array.isArray(summary) ? summary : [summary]).map((entry) => ({
    ...entry,
    project: entry.project ?? project,
    currency: entry.currency ?? baseCurrency._id,
    advance: entry.advance ?? { amount: 0 },
    negativeTotal: entry.negativeTotal ?? sumAmounts(entry.expenses.amount, entry.lumpSums?.amount ?? 0) < 0,
    advanceOverflow: entry.advanceOverflow ?? entry.total.amount < (entry.advance?.amount ?? 0)
  }))
}
