import { Types } from 'mongoose'
import Formatter from '../common/formatter.js'
import { TravelCalculator } from '../common/travel.js'
import { CountryCode, Country as ICountry, Locale } from '../common/types.js'
import { getDisplaySettings, getPrinterSettings, getTravelSettings } from './db.js'
import i18n from './i18n.js'
import Country from './models/country.js'
import DocumentFile from './models/documentFile.js'
import Organisation from './models/organisation.js'
import { ApprovedTravelsPrinter } from './pdf/approvedTravelsPrinter.js'
import { ReportPrinter } from './pdf/reportPrinter.js'

const displaySettings = await getDisplaySettings()
export const formatter = new Formatter(displaySettings.locale.default, displaySettings.nameDisplayFormat)

const printerSettings = await getPrinterSettings()
const travelSettings = await getTravelSettings()
export const reportPrinter = new ReportPrinter<Types.ObjectId>(
  printerSettings,
  travelSettings.distanceRefunds,
  formatter,
  (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => {
    return i18n.t(textIdentifier, { lng: language, ...interpolation }) as string
  },
  async (id) => {
    const doc = await DocumentFile.findOne({ _id: id }).lean()
    if (doc) {
      // Wrong type in mongodb BSON Binary, so need assertion here
      return { buffer: doc.data.buffer as unknown as ArrayBuffer, type: doc.type }
    }
    return null
  },
  async (id) => {
    const orga = await Organisation.findOne({ _id: id }).lean()
    if (orga?.logo?._id) {
      return { logoId: orga.logo._id, website: orga.website }
    }
    return null
  }
)

export const approvedTravelsPrinter = new ApprovedTravelsPrinter<Types.ObjectId>(
  printerSettings,
  formatter,
  (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => {
    return i18n.t(textIdentifier, { lng: language, ...interpolation }) as string
  },
  async (id) => {
    const doc = await DocumentFile.findOne({ _id: id }).lean()
    if (doc) {
      // Wrong type in mongodb BSON Binary, so need assertion here
      return { buffer: doc.data.buffer as unknown as ArrayBuffer, type: doc.type }
    }
    return null
  },
  async (id) => {
    const orga = await Organisation.findOne({ _id: id }).lean()
    if (orga?.logo?._id) {
      return { logoId: orga.logo._id, website: orga.website }
    }
    return null
  }
)
approvedTravelsPrinter.setAllowSpouseRefund(travelSettings.allowSpouseRefund)

export const travelCalculator = new TravelCalculator(
  (id: CountryCode) => Country.findOne({ _id: id }).lean() as Promise<ICountry>,
  await getTravelSettings()
)
