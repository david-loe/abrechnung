import countries from 'abrechnung-common/data/countries.json' with { type: 'json' }
import currencies from 'abrechnung-common/data/currencies.json' with { type: 'json' }
import displaySettings from 'abrechnung-common/data/displaySettings.js'
import printerSettings from 'abrechnung-common/print/printerSettings.js'
import { addLumpSumsToCountries, LumpSumsJSON } from 'abrechnung-common/travel/lumpSums.js'
import travelSettings from 'abrechnung-common/travel/travelSettings.js'
import {
  accesses,
  ConnectionSettings as IConnectionSettings,
  Country as ICountry,
  DisplaySettings as IDisplaySettings,
  PrinterSettings as IPrinterSettings,
  Settings as ISettings,
  TravelSettings as ITravelSettings,
  User as IUser,
  tokenAdminUser
} from 'abrechnung-common/types.js'
import { mergeDeep } from 'abrechnung-common/utils/scripts.js'
import axios from 'axios'
import MongoStore from 'connect-mongo'
import mongoose, { Connection, HydratedDocument, Model } from 'mongoose'
import { CACHE } from './data/cache.js'
import connectionSettingsDev from './data/connectionSettings.development.js'
import connectionSettingsProd from './data/connectionSettings.production.js'
import healthInsurances from './data/healthInsurances.json' with { type: 'json' }
import settings from './data/settings.js'
import ENV from './env.js'
import { genAuthenticatedLink } from './helper.js'
import { logger } from './logger.js'
import Category from './models/category.js'
import Country from './models/country.js'
import Currency from './models/currency.js'
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
    const mergedSettings = mergeDeep({}, settings satisfies Omit<ISettings, '_id'>, DBsettings)
    await mongoose.connection.collection('settings').findOneAndDelete({})
    await mongoose.connection.collection('settings').insertOne(mergedSettings)
    logger.info('Updated Settings')
  } else {
    await mongoose.connection.collection('settings').insertOne(settings)
    logger.info('Created Settings from Default')
  }

  if ((await mongoose.connection.collection('travelsettings').countDocuments()) === 0) {
    await mongoose.connection.collection('travelsettings').insertOne(travelSettings satisfies Omit<ITravelSettings, '_id'>)
  }

  if ((await mongoose.connection.collection('printersettings').countDocuments()) === 0) {
    await mongoose.connection.collection('printersettings').insertOne(printerSettings satisfies Omit<IPrinterSettings, '_id'>)
  }

  if ((await mongoose.connection.collection('displaysettings').countDocuments()) === 0) {
    await mongoose.connection.collection('displaysettings').insertOne(displaySettings satisfies Omit<IDisplaySettings, '_id'>)
  }

  if ((await mongoose.connection.collection('connectionsettings').countDocuments()) === 0) {
    if (ENV.NODE_ENV === 'production') {
      if (ENV.PROD_INIT_CONNECTION_SETTINGS) {
        await mongoose.connection
          .collection('connectionsettings')
          .insertOne({
            PDFReportsViaEmail: { sendPDFReportsToOrganisationEmail: false, locale: 'de' },
            auth: {},
            ...ENV.PROD_INIT_CONNECTION_SETTINGS
          } satisfies Omit<IConnectionSettings, '_id'>)
      } else {
        await mongoose.connection
          .collection('connectionsettings')
          .insertOne(connectionSettingsProd satisfies Omit<IConnectionSettings, '_id'>)
      }
    } else {
      await mongoose.connection.collection('connectionsettings').insertOne(connectionSettingsDev satisfies Omit<IConnectionSettings, '_id'>)
    }
  }

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

  if (ENV.NODE_ENV === 'production' && ENV.PROD_INIT_ADMIN_USER && (await mongoose.connection.collection('users').countDocuments()) === 0) {
    const ac: Partial<IUser['access']> = {}
    for (const access of accesses) {
      ac[access] = access !== 'approved:travel'
    }
    const adminUser: Omit<IUser, '_id'> = {
      ...ENV.PROD_INIT_ADMIN_USER,
      fk: { magiclogin: ENV.PROD_INIT_ADMIN_USER.email },
      access: ac as IUser['access'],
      settings: { language: 'de', hasUserSetLanguage: false, lastCountries: [], lastCurrencies: [], showInstallBanner: true },
      projects: { assigned: [], supervised: [] }
    }
    await mongoose.connection.collection('users').insertOne(adminUser)
  }

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

export const BACKEND_CACHE = await CACHE.create(
  {
    loadSettings: getSettings,
    loadConnectionSettings: getConnectionSettings,
    loadDisplaySettings: getDisplaySettings,
    loadPrinterSettings: getPrinterSettings,
    loadTravelSettings: getTravelSettings
  }, // only init on server start or setup(migration test) or test NOT workers
  process.argv[1].endsWith('server.js') || process.argv[1].endsWith('setup.js') || process.argv[1].includes('ava')
)
