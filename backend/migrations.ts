import countries from 'abrechnung-common/data/countries.json' with { type: 'json' }
import currencies from 'abrechnung-common/data/currencies.json' with { type: 'json' }
import type { AnyBulkWriteOperation, Filter, MatchKeysAndValues, WithId } from 'mongodb'
import mongoose from 'mongoose'
import semver from 'semver'
import { logger } from './logger.js'
import Settings from './models/settings.js'

type EmbeddedExchangeRate = { rate?: unknown }
type MoneyWithExchangeRate = { exchangeRate?: EmbeddedExchangeRate | null }
type MigrationDocument = { _id: mongoose.Types.ObjectId }
type AdvanceMigrationDocument = MigrationDocument & { budget?: MoneyWithExchangeRate | null }
type CostItem = { cost?: MoneyWithExchangeRate | null }
type ExpenseMigrationDocument = MigrationDocument & { expenses?: CostItem[] }
type TravelMigrationDocument = ExpenseMigrationDocument & { stages?: CostItem[] }

function convertRateToQuantityNotation(money: MoneyWithExchangeRate | null | undefined) {
  const exchangeRate = money?.exchangeRate
  if (!exchangeRate || typeof exchangeRate.rate !== 'number' || !Number.isFinite(exchangeRate.rate) || exchangeRate.rate <= 0) {
    return false
  }
  exchangeRate.rate = 1 / exchangeRate.rate
  return true
}

function convertCostItemsToQuantityNotation(items: CostItem[] | undefined) {
  let modified = false
  for (const item of items || []) {
    modified = convertRateToQuantityNotation(item.cost) || modified
  }
  return modified
}

async function migrateCollection<T extends MigrationDocument>(
  collectionName: string,
  filter: Filter<T>,
  migrateDocument: (doc: WithId<T>) => MatchKeysAndValues<T> | null
) {
  const collection = mongoose.connection.collection<T>(collectionName)
  const batch: AnyBulkWriteOperation<T>[] = []
  const cursor = collection.find(filter)

  async function flushBatch() {
    if (batch.length > 0) {
      await collection.bulkWrite(batch)
      batch.length = 0
    }
  }

  for await (const doc of cursor) {
    const updatedFields = migrateDocument(doc)
    if (updatedFields) {
      batch.push({ updateOne: { filter: { _id: doc._id } as Filter<T>, update: { $set: updatedFields } } })
    }
    if (batch.length >= 1000) {
      await flushBatch()
    }
  }
  await flushBatch()
}

async function migrateExchangeRatesToQuantityNotation() {
  logger.info('Apply migration from v2.6.1: convert exchange rates to quantity notation')

  await migrateCollection<AdvanceMigrationDocument>('advances', { 'budget.exchangeRate.rate': { $gt: 0 } }, (doc) =>
    convertRateToQuantityNotation(doc.budget) ? { budget: doc.budget } : null
  )

  const expenseFilter = { 'expenses.cost.exchangeRate.rate': { $gt: 0 } }
  await migrateCollection<ExpenseMigrationDocument>('expensereports', expenseFilter, (doc) =>
    convertCostItemsToQuantityNotation(doc.expenses) ? { expenses: doc.expenses } : null
  )
  await migrateCollection<ExpenseMigrationDocument>('healthcarecosts', expenseFilter, (doc) =>
    convertCostItemsToQuantityNotation(doc.expenses) ? { expenses: doc.expenses } : null
  )

  await migrateCollection<TravelMigrationDocument>(
    'travels',
    { $or: [{ 'stages.cost.exchangeRate.rate': { $gt: 0 } }, expenseFilter] },
    (doc) => {
      const stagesModified = convertCostItemsToQuantityNotation(doc.stages)
      const expensesModified = convertCostItemsToQuantityNotation(doc.expenses)
      if (!stagesModified && !expensesModified) {
        return null
      }
      return { ...(stagesModified ? { stages: doc.stages } : {}), ...(expensesModified ? { expenses: doc.expenses } : {}) }
    }
  )

  await mongoose.connection.collection('exchangerates').deleteMany({})
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
    if (semver.lte(migrateFrom, '2.6.1')) {
      await migrateExchangeRatesToQuantityNotation()
    }
    settings.migrateFrom = undefined
    await settings.save()
  }
}
