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

await connectDB()

async function connectDB() {
  const first = mongoose.connection.readyState === 0
  if (first) {
    await mongoose.connect(process.env.MONGO_URL ? process.env.MONGO_URL : 'mongodb://127.0.0.1:27017/abrechnung')
    console.log(i18n.t('alerts.db.success'))
    await initDB()
  } else {
    await mongoose.connection.asPromise()
  }
}

async function initDB() {
  const DBsettings = await Settings.findOne().lean()
  if (DBsettings) {
    if (DBsettings.version !== settings.version) {
      DBsettings.migrateFrom = DBsettings.version
    }
    DBsettings.version = settings.version
    await Settings.findOneAndUpdate(undefined, Object.assign({}, settings, DBsettings)).lean()
    console.log(i18n.t('alerts.db.updatedSettings'))
  } else {
    await new Settings(settings).save()
    console.log(i18n.t('alerts.db.createdSettings'))
  }
  await initer<any>(Currency, 'currencies', currencies)
  await initer<any>(Country, 'countries', countries)
  await addAllLumpSums()
  initer(HealthInsurance, 'health insurances', healthInsurances)
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

async function addAllLumpSums() {
  iLumpSums.sort((a, b) => new Date(a.validFrom).valueOf() - new Date(b.validFrom).valueOf())
  for (const lumpSum of iLumpSums) {
    const result = await addLumpSumsToCountries(lumpSum.data, new Date(lumpSum.validFrom), 'de')
    console.log(
      'Lump sum from ' +
        lumpSum.validFrom +
        ': ' +
        result.success.length +
        ' updated - ' +
        result.noUpdate.length +
        ' not updated - ' +
        result.noCountryFound.length +
        ' no country found'
    )
    for (const notFound of result.noCountryFound) {
      console.log(notFound.country)
    }
  }
}

export async function addLumpSumsToCountries(lumpSums: (typeof iLumpSums)[0]['data'], validFrom: Date, countryNameLanguage = 'de') {
  const conditions: any = {}
  const noCountryFound = []
  const success = []
  const noUpdate = []
  for (const lumpSum of lumpSums) {
    conditions.$or = [{}, {}]
    conditions.$or[0]['name.' + countryNameLanguage] = lumpSum.country
    conditions.$or[1]['alias.' + countryNameLanguage] = lumpSum.country

    const country = await Country.findOne(conditions)
    if (country) {
      var newData = true
      for (const countrylumpSums of country.lumpSums) {
        if ((countrylumpSums.validFrom as Date).valueOf() >= validFrom.valueOf()) {
          newData = false
          break
        }
      }
      if (newData) {
        const newLumpSum: CountryLumpSum = Object.assign({ validFrom }, convertRawLumpSum(lumpSum))
        country.lumpSums.push(newLumpSum)
        country.markModified('lumpSums')
        success.push(await country.save())
      } else {
        noUpdate.push(country)
      }
    } else {
      noCountryFound.push(lumpSum)
    }
  }
  return { success, noUpdate, noCountryFound }
}

function convertRawLumpSum(raw: (typeof iLumpSums)[0]['data'][0]): Omit<CountryLumpSum, 'validFrom'> {
  const spezials: CountryLumpSum['spezials'] = []
  if (raw.spezials) {
    for (const spezial of raw.spezials as { [key: string]: string | string[] }[]) {
      spezials.push({
        catering24: parseInt(spezial.catering24 as string, 10),
        catering8: parseInt(spezial.catering8 as string, 10),
        overnight: parseInt(spezial.overnight as string, 10),
        city: spezial.city as string
      })
    }
  }

  return {
    catering24: parseInt(raw.catering24 as string, 10),
    catering8: parseInt(raw.catering8 as string, 10),
    overnight: parseInt(raw.overnight as string, 10),
    spezials
  }
}
