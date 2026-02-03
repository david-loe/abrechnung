import countries from 'abrechnung-common/data/countries.json' with { type: 'json' }
import currencies from 'abrechnung-common/data/currencies.json' with { type: 'json' }
import mongoose from 'mongoose'
import semver from 'semver'
import { logger } from './logger.js'
import Settings from './models/settings.js'

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
    }
    settings.migrateFrom = undefined
    await settings.save()
  }
}
