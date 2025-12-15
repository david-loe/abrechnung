import countries from 'abrechnung-common/data/countries.json' with { type: 'json' }
import currencies from 'abrechnung-common/data/currencies.json' with { type: 'json' }
import displaySettings from 'abrechnung-common/data/displaySettings.json' with { type: 'json' }
import printerSettings from 'abrechnung-common/print/printerSettings.json' with { type: 'json' }
import { addLumpSumsToCountries, LumpSumsJSON } from 'abrechnung-common/travel/lumpSums.js'
import travelSettings from 'abrechnung-common/travel/travelSettings.json' with { type: 'json' }
import {
  ConnectionSettings as IConnectionSettings,
  Country as ICountry,
  DisplaySettings as IDisplaySettings,
  PrinterSettings as IPrinterSettings,
  Settings as ISettings,
  TravelSettings as ITravelSettings,
  tokenAdminUser
} from 'abrechnung-common/types.js'
import { mergeDeep } from 'abrechnung-common/utils/scripts.js'
import axios from 'axios'
import MongoStore from 'connect-mongo'
import mongoose, { Connection, HydratedDocument, Model, Types } from 'mongoose'
import { CACHE } from './data/cache.js'
import connectionSettingsDev from './data/connectionSettings.development.json' with { type: 'json' }
import connectionSettingsProd from './data/connectionSettings.production.json' with { type: 'json' }
import healthInsurances from './data/healthInsurances.json' with { type: 'json' }
import settings from './data/settings.json' with { type: 'json' }
import ENV from './env.js'
import { genAuthenticatedLink } from './helper.js'
import { logger } from './logger.js'
import Category from './models/category.js'
import ConnectionSettings from './models/connectionSettings.js'
import Country from './models/country.js'
import Currency from './models/currency.js'
import DisplaySettings from './models/displaySettings.js'
import HealthInsurance from './models/healthInsurance.js'
import Organisation from './models/organisation.js'
import Project from './models/project.js'

let connectionPromise: Promise<Connection> | null = null

export function connectDB(init = true) {
  if (!connectionPromise) {
    mongoose.connection.on('connected', () => logger.debug('Connected to Database'))
    mongoose.connection.on('disconnected', () => logger.debug('Disconnected from Database'))
    connectionPromise = (async () => {
      const mongoDB = await mongoose.connect(ENV.MONGO_URL)
      if (init) {
        await initDB()
      }
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

  if (ENV.NODE_ENV === 'production') {
    await initer(ConnectionSettings, 'connectionSettings', [connectionSettingsProd])
  } else {
    await initer(ConnectionSettings, 'connectionSettings', [connectionSettingsDev as Partial<IConnectionSettings<Types.ObjectId>>], true)
  }

  await initer(DisplaySettings, 'displaySettings', [displaySettings as Partial<IDisplaySettings<Types.ObjectId>>])

  await initer(Currency, 'currencies', currencies)
  await initer(Country, 'countries', countries)
  await fetchAndUpdateLumpSums()
  initer(HealthInsurance, 'health insurances', healthInsurances)

  const organisations = [{ name: 'My Organisation' }]
  await initer(Organisation, 'organisation', organisations)
  const org = await Organisation.findOne()
  const projects = [{ identifier: '001', organisation: org?._id, name: 'Expense Management' }]
  await initer(Project, 'projects', projects)
  const categories = [{ name: 'General', style: { color: '#D8DCFF', text: 'black' as const }, isDefault: true }]
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
  const pauschbetrag_api = 'https://cdn.jsdelivr.net/npm/pauschbetrag-api@1/ALL.json'
  try {
    const res = await axios.get<LumpSumsJSON>(pauschbetrag_api)
    if (res.status === 200) {
      await addLumpSumsToCountries(
        res.data,
        (id) => Country.findOne({ _id: id }),
        async (c) => {
          ;(c as HydratedDocument<ICountry>).markModified('lumpSums')
          return (c as HydratedDocument<ICountry>).save()
        }
      )
    }
  } catch (error) {
    logger.error(`Unable to fetch lump sums from: ${pauschbetrag_api}`, 'error')
    logger.error(error, 'error')
  }
}

export async function getSettings(init = true): Promise<ISettings> {
  await connectDB(init)
  const settings = (await mongoose.connection.collection('settings').findOne()) as ISettings | null
  if (settings) {
    return settings
  }
  throw Error('Settings not found')
}

export async function getTravelSettings(init = true): Promise<ITravelSettings> {
  await connectDB(init)
  const travelSettings = (await mongoose.connection.collection('travelsettings').findOne()) as ITravelSettings | null
  if (travelSettings) {
    return travelSettings
  }
  throw Error('Travel Settings not found')
}

export async function getPrinterSettings(init = true): Promise<IPrinterSettings> {
  await connectDB(init)
  const printerSettings = (await mongoose.connection.collection('printersettings').findOne()) as IPrinterSettings | null
  if (printerSettings) {
    return printerSettings
  }
  throw Error('Printer Settings not found')
}

export async function getConnectionSettings(init = true): Promise<IConnectionSettings> {
  await connectDB(init)
  const connectionSettings = (await mongoose.connection.collection('connectionsettings').findOne()) as IConnectionSettings | null
  if (connectionSettings) {
    return connectionSettings
  }
  throw Error('Connection Settings not found')
}

export async function getDisplaySettings(init = true): Promise<IDisplaySettings> {
  await connectDB(init)
  const displaySettings = (await mongoose.connection.collection('displaysettings').findOne()) as IDisplaySettings | null
  if (displaySettings) {
    return displaySettings
  }
  throw Error('Display Settings not found')
}

// only init on server start or setup(migration test) or test NOT workers
export const BACKEND_CACHE = await CACHE.create(
  process.argv[1].endsWith('server.js') || process.argv[1].endsWith('setup.js') || process.argv[1].includes('ava')
)
