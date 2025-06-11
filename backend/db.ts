import axios from 'axios'
import MongoStore from 'connect-mongo'
import mongoose, { Connection, Model } from 'mongoose'
import { mergeDeep } from '../common/scripts.js'
import {
  CountryLumpSum,
  ConnectionSettings as IConnectionSettings,
  DisplaySettings as IDisplaySettings,
  LedgerAccount as ILedgerAccount,
  Organisation as IOrganisation,
  PrinterSettings as IPrinterSettings,
  Settings as ISettings,
  TravelSettings as ITravelSettings,
  TravelExpenseItem,
  _id,
  tokenAdminUser,
  travelExpenseItems
} from '../common/types.js'
import connectionSettingsDev from './data/connectionSettings.development.json' with { type: 'json' }
import connectionSettingsProd from './data/connectionSettings.production.json' with { type: 'json' }
import countries from './data/countries.json' with { type: 'json' }
import currencies from './data/currencies.json' with { type: 'json' }
import displaySettings from './data/displaySettings.json' with { type: 'json' }
import healthInsurances from './data/healthInsurances.json' with { type: 'json' }
import printerSettings from './data/printerSettings.json' with { type: 'json' }
import settings from './data/settings.json' with { type: 'json' }
import travelSettings from './data/travelSettings.json' with { type: 'json' }
import { genAuthenticatedLink } from './helper.js'
import { logger } from './logger.js'
import Category from './models/category.js'
import ConnectionSettings from './models/connectionSettings.js'
import Country from './models/country.js'
import Currency from './models/currency.js'
import DisplaySettings from './models/displaySettings.js'
import HealthInsurance from './models/healthInsurance.js'
import LedgerAccount from './models/ledgerAccount.js'
import Organisation from './models/organisation.js'
import Project from './models/project.js'

let connectionPromise: Promise<Connection> | null = null

export function connectDB() {
  if (!connectionPromise) {
    mongoose.connection.on('connected', () => logger.debug('Connected to Database'))
    mongoose.connection.on('disconnected', () => logger.debug('Disconnected from Database'))
    connectionPromise = (async () => {
      const mongoDB = await mongoose.connect(process.env.MONGO_URL)
      await initDB()
      return mongoDB.connection
    })()
  }
  return connectionPromise
}

export async function disconnectDB() {
  await mongoose.disconnect()
}

let sessionStorePromise: Promise<MongoStore> | null = null

export function sessionStore() {
  if (!sessionStorePromise) {
    if (connectionPromise) {
      sessionStorePromise = (async () => {
        return MongoStore.create({ client: (await connectionPromise).getClient() })
      })()
    } else {
      throw Error('No connection to database started')
    }
  }
  return sessionStorePromise
}

export async function initDB() {
  const DBsettings = (await mongoose.connection.collection('settings').findOne()) as ISettings | null
  if (DBsettings) {
    if (DBsettings.version !== settings.version) {
      DBsettings.migrateFrom = DBsettings.version
    }
    DBsettings.version = settings.version
    const mergedSettings = mergeDeep({}, settings, DBsettings)
    await mongoose.connection.collection('settings').findOneAndDelete({})
    await mongoose.connection.collection('settings').insertOne(mergedSettings)
    logger.info('Updated Settings')
  } else {
    await mongoose.connection.collection('settings').insertOne(settings)
    logger.info('Created Settings from Default')
  }

  const DBtravelSettings = (await mongoose.connection.collection('travelsettings').findOne()) as ITravelSettings | null
  if (!DBtravelSettings) {
    await mongoose.connection.collection('travelsettings').insertOne(travelSettings)
  }

  const DBprinterSettings = (await mongoose.connection.collection('printersettings').findOne()) as IPrinterSettings | null
  if (!DBprinterSettings) {
    await mongoose.connection.collection('printersettings').insertOne(printerSettings)
  }

  if (process.env.NODE_ENV === 'production') {
    await initer(ConnectionSettings, 'connectionSettings', [connectionSettingsProd as Partial<IConnectionSettings>])
  } else {
    await initer(ConnectionSettings, 'connectionSettings', [connectionSettingsDev as Partial<IConnectionSettings>], true)
  }

  await initer(DisplaySettings, 'displaySettings', [displaySettings as Partial<IDisplaySettings>])

  await initer(Currency, 'currencies', currencies)
  await initer(Country, 'countries', countries)
  await fetchAndUpdateLumpSums()
  initer(HealthInsurance, 'health insurances', healthInsurances)

  const ledgerAccounts = [
    { identifier: '1530', name: 'Forderungen gegen Personal aus Lohn- und Gehaltsabrechnung' },
    { identifier: '1740', name: 'Verbindlichkeiten aus Lohn und Gehalt' },
    { identifier: '4660', name: 'Reisekosten Arbeitnehmer' },
    { identifier: '4900', name: 'Sonstige betriebliche Aufwendungen' }
  ]
  await initer(LedgerAccount, 'ledger accounts', ledgerAccounts)

  const account1530 = await LedgerAccount.findOne({ identifier: '1530' })
  const account1740 = await LedgerAccount.findOne({ identifier: '1740' })
  const account4660 = await LedgerAccount.findOne({ identifier: '4660' })
  const account4900 = await LedgerAccount.findOne({ identifier: '4900' })
  const organisation = {
    name: 'My Organisation',
    accountingSettings: {
      employeeLiabilitiesAccount: account1740?._id,
      employeeClaimsAccount: account1530?._id,
      accountMapping: {} as { [key in TravelExpenseItem]?: _id }
    }
  }
  for (const item of travelExpenseItems) {
    organisation.accountingSettings.accountMapping[item] = account4660?._id
  }

  await initer(Organisation, 'organisation', [organisation as any])
  const org = await Organisation.findOne()
  const projects = [{ identifier: '001', organisation: org?._id, name: 'Expense Management' }]
  await initer(Project, 'projects', projects)
  const categories = [
    { name: 'General', style: { color: '#D8DCFF', text: 'black' as const }, isDefault: true, ledgerAccount: account4900 ?? undefined }
  ]
  await initer(Category, 'category', categories)

  const tokenAdmin = await mongoose.connection.collection('users').findOne({ 'fk.magiclogin': tokenAdminUser.fk.magiclogin })
  if (tokenAdmin) {
    await mongoose.connection.collection('users').updateOne({ _id: tokenAdmin._id }, { $set: { access: tokenAdminUser.access } })
  } else {
    await mongoose.connection.collection('users').insertOne(tokenAdminUser)
  }
  logger.info(
    `SignIn Link: ${await genAuthenticatedLink({ destination: 'admin@to.ken', redirect: '/settings' }, { expiresIn: 60 * 60 * 24 * 365 * 100 })}`
  )
}

async function initer<T>(model: Model<T>, name: string, data: Partial<T>[], lean = false) {
  const doc = await model.exists({})
  if (doc === null) {
    const newDocs = await model.insertMany(data, { lean })
    logger.info(`Added ${newDocs.length} ${name}`)
  }
}

export async function fetchAndUpdateLumpSums() {
  const pauschbetrag_api = 'https://cdn.jsdelivr.net/npm/pauschbetrag-api/ALL.json'
  try {
    const res = await axios.get<LumpSumsJSON>(pauschbetrag_api)
    if (res.status === 200) {
      await addLumpSumsToCountries(res.data)
    }
  } catch (error) {
    logger.error(`Unable to fetch lump sums from: ${pauschbetrag_api}`, 'error')
    logger.error(error, 'error')
  }
}

type LumpSumsJSON = { data: LumpSumWithCountryCode[]; validFrom: string }[]
type LumpSumWithCountryCode = Omit<CountryLumpSum, 'validFrom'> & { countryCode: string }
async function addLumpSumsToCountries(lumpSumsJSON: LumpSumsJSON) {
  lumpSumsJSON.sort((a, b) => new Date(a.validFrom).valueOf() - new Date(b.validFrom).valueOf())
  for (const lumpSums of lumpSumsJSON) {
    const validFrom = new Date(lumpSums.validFrom).valueOf()
    let count = 0
    for (const lumpSum of lumpSums.data) {
      const country = await Country.findOne({ _id: lumpSum.countryCode })
      if (country) {
        let newData = true
        for (const countrylumpSums of country.lumpSums) {
          if ((countrylumpSums.validFrom as Date).valueOf() >= validFrom) {
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
        throw new Error(`No Country with id "${lumpSum.countryCode}" found`)
      }
    }
    if (count > 0) {
      logger.info(`Added ${count} lump sums for ${new Date(lumpSums.validFrom)}`)
    }
  }
}

export async function getSettings(): Promise<ISettings> {
  await connectDB()
  const settings = (await mongoose.connection.collection('settings').findOne()) as ISettings | null
  if (settings) {
    return settings
  }
  throw Error('Settings not found')
}

export async function getTravelSettings(): Promise<ITravelSettings> {
  await connectDB()
  const travelSettings = (await mongoose.connection.collection('travelsettings').findOne()) as ITravelSettings | null
  if (travelSettings) {
    return travelSettings
  }
  throw Error('Travel Settings not found')
}

export async function getPrinterSettings(): Promise<IPrinterSettings> {
  await connectDB()
  const printerSettings = (await mongoose.connection.collection('printersettings').findOne()) as IPrinterSettings | null
  if (printerSettings) {
    return printerSettings
  }
  throw Error('Printer Settings not found')
}

export async function getConnectionSettings(): Promise<IConnectionSettings> {
  await connectDB()
  const connectionSettings = (await mongoose.connection.collection('connectionsettings').findOne()) as IConnectionSettings | null
  if (connectionSettings) {
    return connectionSettings
  }
  throw Error('Connection Settings not found')
}

export async function getDisplaySettings(): Promise<IDisplaySettings> {
  await connectDB()
  const displaySettings = (await mongoose.connection.collection('displaysettings').findOne()) as IDisplaySettings | null
  if (displaySettings) {
    return displaySettings
  }
  throw Error('Display Settings not found')
}
