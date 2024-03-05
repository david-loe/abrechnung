import settings from './data/settings.json' assert { type: 'json' }
import healthInsurances from './data/healthInsurances.json' assert { type: 'json' }
import countries from './data/countries.json' assert { type: 'json' }
import currencies from './data/currencies.json' assert { type: 'json' }
import iLumpSums from './data/lumpSums.json' assert { type: 'json' }
import organisations from './data/organisations.json' assert { type: 'json' }
import Settings from './models/settings.js'
import Currency from './models/currency.js'
import Country from './models/country.js'
import HealthInsurance from './models/healthInsurance.js'
import mongoose, { Model } from 'mongoose'
import i18n from './i18n.js'
import { CountryLumpSum } from '../common/types.js'
import Organisation from './models/organisation.js'
import { LumpSumsJSON } from './data/parser.js'

await connectDB()

export async function connectDB() {
  const first = mongoose.connection.readyState === 0
  if (first) {
    await mongoose.connect(process.env.MONGO_URL ? process.env.MONGO_URL : 'mongodb://127.0.0.1:27017/abrechnung')
    console.log(i18n.t('alerts.db.success'))
    await initDB()
  } else {
    await mongoose.connection.asPromise()
  }
}

export function disconnectDB() {
  return mongoose.disconnect()
}

export async function initDB() {
  const DBsettings = await Settings.findOne().lean()
  if (DBsettings) {
    if (DBsettings.version !== settings.version) {
      DBsettings.migrateFrom = DBsettings.version
    }
    DBsettings.version = settings.version
    const mergedSettings = Object.assign({}, settings, DBsettings)
    await Settings.findOneAndDelete()
    await new Settings(mergedSettings).save()
    console.log(i18n.t('alerts.db.updatedSettings'))
  } else {
    await new Settings(settings).save()
    console.log(i18n.t('alerts.db.createdSettings'))
  }
  await initer<any>(Currency, 'currencies', currencies)
  await initer<any>(Country, 'countries', countries)
  await addLumpSumsToCountries(iLumpSums)
  initer<any>(HealthInsurance, 'health insurances', healthInsurances)
  initer<any>(Organisation, 'organisation', organisations)
}

async function initer<T>(model: Model<T>, name: string, data: T[]) {
  const docs = await model.find().lean()
  if (docs.length === 0) {
    const newDocs = await model.insertMany(data)
    console.log('Added ' + newDocs.length + ' ' + name)
  } else {
    console.log(docs.length + ' ' + name + ' exist')
  }
}

async function addLumpSumsToCountries(lumpSumsJSON: LumpSumsJSON) {
  lumpSumsJSON.sort((a, b) => a.validFrom - b.validFrom)
  for (const lumpSums of lumpSumsJSON) {
    var count = 0
    for (const lumpSum of lumpSums.data) {
      const country = await Country.findOne({ _id: lumpSum.countryCode })
      if (country) {
        var newData = true
        for (const countrylumpSums of country.lumpSums) {
          if ((countrylumpSums.validFrom as Date).valueOf() >= lumpSums.validFrom) {
            newData = false
            break
          }
        }
        if (newData) {
          const newLumpSum: CountryLumpSum = Object.assign({ validFrom: new Date(lumpSums.validFrom) }, lumpSum)
          country.lumpSums.push(newLumpSum)
          country.markModified('lumpSums')
          country.save()
          count++
        }
      } else {
        throw new Error('No Country with id "' + lumpSum.countryCode + '" found')
      }
    }
    if (count > 0) {
      console.log('Added ' + count + ' lump sums for ' + new Date(lumpSums.validFrom))
    }
  }
}
