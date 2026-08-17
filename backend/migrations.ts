import countries from 'abrechnung-common/data/countries.json' with { type: 'json' }
import currencies from 'abrechnung-common/data/currencies.json' with { type: 'json' }
import { baseCurrency, ReportModelName, travelExpenseItems } from 'abrechnung-common/types.js'
import { roundAmount } from 'abrechnung-common/utils/scripts.js'
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

export async function checkForMigrations() {
  const settings = await Settings.findOne()
  if (settings?.migrateFrom) {
    const migrateFrom = settings.migrateFrom
    const minVersion = '2.3.3'
    if (semver.lt(migrateFrom, minVersion)) {
      throw new Error(`Migration from v${migrateFrom} to v${settings.version} not supported. Migrate to v${minVersion} first.`)
    }

    if (semver.lte(migrateFrom, '2.3.3')) {
      logger.info('Apply migration from v2.3.3: update country and currency names')

      const countryCol = mongoose.connection.collection<{ name: { [key: string]: string }; _id: string }>('countries')
      const countryBatch = []
      for (const country of countries) {
        countryBatch.push({ updateOne: { filter: { _id: country.code }, update: { $set: { name: country.name } } } })
      }
      await countryCol.bulkWrite(countryBatch)

      const currencyCol = mongoose.connection.collection<{ name: { [key: string]: string }; _id: string }>('currencies')
      const currencyBatch = []
      for (const currency of currencies) {
        currencyBatch.push({ updateOne: { filter: { _id: currency.code }, update: { $set: { name: currency.name } } } })
      }
      await currencyCol.bulkWrite(currencyBatch)

      logger.info('Apply migration from v2.3.3: update advance offsetAgainst subject')
      const advanceCol = mongoose.connection.collection<{ offsetAgainst: Record<string, unknown>[] }>('advances')
      const advanceBatch = []
      const cursor = advanceCol.find()
      for await (const doc of cursor) {
        const newOffsetAgainst = []
        for (const offset of doc.offsetAgainst) {
          let subject = ''
          if (offset.report) {
            const report = await mongoose
              .model<{ name: string }>(offset.type as string)
              .findOne({ _id: offset.report })
              .lean()
            subject = report?.name || ''
          }
          newOffsetAgainst.push({
            reportId: offset.report,
            type: offset.report ? offset.type : 'offsetEntry',
            subject,
            amount: offset.amount
          })
        }
        advanceBatch.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { offsetAgainst: newOffsetAgainst } } } })
      }
      if (advanceBatch.length > 0) {
        await advanceCol.bulkWrite(advanceBatch)
      }
    }
    if (semver.lte(migrateFrom, '2.4.3')) {
      logger.info('Apply migration from v2.4.3: add oauth2 option to smtp settings')
      await mongoose.connection
        .collection('connectionsettings')
        .updateMany(
          { smtp: { $exists: true } },
          { $set: { 'smtp.auth.authType': 'Login' }, $rename: { 'smtp.user': 'smtp.auth.user', 'smtp.password': 'smtp.auth.pass' } }
        )

      logger.info('Apply migration from v2.4.3: add bookingRemark option to printer settings')
      await mongoose.connection
        .collection('printersettings')
        .updateMany(
          {},
          {
            $set: {
              'options.travel.bookingRemark': false,
              'options.expenseReport.bookingRemark': false,
              'options.healthCareCost.bookingRemark': false,
              'options.advance.bookingRemark': false
            }
          }
        )
    }
    if (semver.lte(migrateFrom, '2.5.0')) {
      logger.info('Apply migration from v2.5.0: add additionalOwnerDetails option to printer settings')
      await mongoose.connection
        .collection('printersettings')
        .updateMany(
          {},
          {
            $set: {
              'options.travel.additionalOwnerDetails': true,
              'options.expenseReport.additionalOwnerDetails': true,
              'options.healthCareCost.additionalOwnerDetails': true,
              'options.advance.additionalOwnerDetails': true
            }
          }
        )
    }
    if (semver.lte(migrateFrom, '2.5.3')) {
      logger.info('Apply migration from v2.5.3: move retention policy to integration settings')

      const settingsCol = mongoose.connection.collection('settings')
      const integrationSettingsCol = mongoose.connection.collection('integrationsettings')

      const currentSettings = await settingsCol.findOne({})

      if (currentSettings && 'retentionPolicy' in currentSettings) {
        await integrationSettingsCol.updateOne(
          { integrationKey: 'retentionPolicy' },
          { $set: { settings: currentSettings.retentionPolicy } }
        )
      }

      await settingsCol.updateMany({}, { $unset: { retentionPolicy: '' } })
    }
    if (semver.lte(migrateFrom, '2.6.2')) {
      logger.info('Apply migration from v2.6.2: Drop exchange rate collection')
      await mongoose.connection.collection('exchangerates').drop()
      await mongoose.connection.collection('settings').updateMany({}, { $set: { exchangeRateProvider: 'InforEuro' } })
    }
    if (semver.lte(migrateFrom, '2.6.3')) {
      logger.info('Apply migration from v2.6.3: initialize atomic report reference counters')
      await initializeReferenceCounters()
    }
    if (semver.lte(migrateFrom, '2.6.4')) {
      logger.info('Apply migration from v2.6.4: introduce cost positions and VAT settings')
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

      await mongoose.connection
        .collection('organisations')
        .updateMany(
          {},
          {
            $set: {
              'accountingSettings.employeeLiabilitiesAccount': account1740._id,
              'accountingSettings.employeeClaimsAccount': account1530._id,
              'accountingSettings.accountMapping': accountMapping,
              'accountingSettings.vatAccountingEnabled': false,
              'accountingSettings.includeBankBookings': false,
              'accountingSettings.payoutAccounts': [],
              'accountingSettings.vatRates': [
                { rate: 0 },
                { rate: 7, inputTaxAccount: account1571._id },
                { rate: 19, inputTaxAccount: account1576._id }
              ]
            }
          }
        )

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
          if (collectionName === 'travels') {
            const stages = []
            for (const stage of report.stages ?? []) {
              const cost = { ...stage.cost }
              const project = stage.project ?? report.project
              if (!Array.isArray(cost.positions)) {
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

      logger.info('Apply migration from v2.6.4: initialize SEPA payout settings')
      await mongoose.connection
        .collection('ledgeraccounts')
        .updateOne({ identifier: '1200' }, { $setOnInsert: { identifier: '1200', name: 'Bank' } }, { upsert: true })
    }
    if (semver.lte(migrateFrom, '2.7.0')) {
      logger.info('Apply migration from v2.7.0: add user and project creation access')
      await initializeUsersAndProjectsCreationAccess()
    }
    if (semver.lte(migrateFrom, '2.7.1')) {
      logger.info('Apply migration from v2.7.1: add expense report currencies and currency-aware advances')
      const ledgerAccounts = mongoose.connection.collection('ledgeraccounts')
      await ledgerAccounts.updateOne(
        { identifier: '2660' },
        { $setOnInsert: { identifier: '2660', name: 'Kursdifferenzen' } },
        { upsert: true }
      )
      const exchangeDifferencesAccount = await ledgerAccounts.findOne({ identifier: '2660' })
      if (!exchangeDifferencesAccount) throw new Error('Failed to initialize currency exchange differences account 2660')
      await mongoose.connection
        .collection('organisations')
        .updateMany({}, { $set: { 'accountingSettings.currencyExchangeDifferencesAccount': exchangeDifferencesAccount._id } })

      await Promise.all(
        ['travels', 'expensereports', 'healthcarecosts'].map((collectionName) =>
          mongoose.connection
            .collection(collectionName)
            .updateMany({ 'addUp.currency': { $exists: false } }, { $set: { 'addUp.$[].currency': baseCurrency._id } })
        )
      )

      const advances = mongoose.connection.collection<{
        _id: mongoose.Types.ObjectId
        budget: { currency: string; exchangeRate?: { date: Date; rate: number; amount: number } | null }
        balance: { amount: number; currency?: string; exchangeRate?: { date: Date; rate: number; amount: number } | null }
        offsetAgainst: { amount: number; [key: string]: unknown }[]
      }>('advances')
      for await (const advance of advances.find()) {
        const currency = advance.budget.currency || baseCurrency._id
        const rate = advance.budget.exchangeRate?.rate
        if (currency !== baseCurrency._id && !rate) {
          const hasAmounts = advance.balance.amount !== 0 || advance.offsetAgainst.some(({ amount }) => amount !== 0)
          if (hasAmounts) {
            throw new Error(`Cannot migrate foreign-currency advance ${advance._id.toString()} without a stored exchange rate`)
          }
        }
        const convertFromEuro = (amount: number) => (currency === baseCurrency._id ? amount : rate ? roundAmount(amount / rate) : 0)
        const exchangeRateFor = (amount: number) =>
          currency === baseCurrency._id || !advance.budget.exchangeRate ? null : { ...advance.budget.exchangeRate, amount }
        await advances.updateOne(
          { _id: advance._id },
          {
            $set: {
              balance: { amount: convertFromEuro(advance.balance.amount), currency, exchangeRate: exchangeRateFor(advance.balance.amount) },
              offsetAgainst: advance.offsetAgainst.map((offset) => ({
                ...offset,
                amount: convertFromEuro(offset.amount),
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
