import mongoose, { Model } from 'mongoose'
import { CountryLumpSum } from '../common/types.js'
import countries from './data/countries.json' assert { type: 'json' }
import currencies from './data/currencies.json' assert { type: 'json' }
import healthInsurances from './data/healthInsurances.json' assert { type: 'json' }
import iLumpSums from './data/lumpSums.json' assert { type: 'json' }
import { LumpSumsJSON } from './data/parser.js'
import settings from './data/settings.json' assert { type: 'json' }
import i18n from './i18n.js'
import Country from './models/country.js'
import Currency from './models/currency.js'
import HealthInsurance from './models/healthInsurance.js'
import Organisation from './models/organisation.js'
import Project from './models/project.js'
import Settings from './models/settings.js'

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
  await initer(Currency, 'currencies', currencies)
  await initer(Country, 'countries', countries)
  await addLumpSumsToCountries(iLumpSums)
  initer(HealthInsurance, 'health insurances', healthInsurances)

  const organisations = [{ name: 'My Organisation' }]
  await initer(Organisation, 'organisation', organisations)
  const org = await Organisation.findOne()
  const projects = [{ identifier: '001', organisation: org?._id, name: 'Expense Management' }]
  initer(Project, 'projects', projects)
}

async function initer<T>(model: Model<T>, name: string, data: Partial<T>[]) {
  const doc = await model.exists({})
  if (doc === null) {
    const newDocs = await model.insertMany(data)
    console.log('Added ' + newDocs.length + ' ' + name)
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
