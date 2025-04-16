import Formatter from '../common/formatter.js'
import { TravelCalculator } from '../common/travel.js'
import { CountryCode, Country as ICountry, Locale, _id } from '../common/types.js'
import { getDisplaySettings, getPrinterSettings, getTravelSettings } from './db.js'
import i18n from './i18n.js'
import Country from './models/country.js'
import DocumentFile from './models/documentFile.js'
import Organisation from './models/organisation.js'
import { ReportPrinter } from './pdf/printer.js'

export const formatter = new Formatter((await getDisplaySettings()).locale.default)

export const reportPrinter = new ReportPrinter(
  await getPrinterSettings(),
  (await getTravelSettings()).distanceRefunds,
  formatter,
  (textIdentifier: string, language: Locale, interpolation?: any) => {
    return i18n.t(textIdentifier, { lng: language, ...interpolation }) as string
  },
  async (id: _id) => {
    const doc = await DocumentFile.findOne({ _id: id }).lean()
    if (doc) {
      return { buffer: doc.data.buffer, type: doc.type }
    }
    return null
  },
  async (id: _id) => {
    const orga = await Organisation.findOne({ _id: id }).lean()
    if (orga?.logo?._id) {
      return { logoId: orga.logo._id, website: orga.website }
    }
    return null
  }
)

export const travelCalculator = new TravelCalculator(
  (id: CountryCode) => Country.findOne({ _id: id }).lean() as Promise<ICountry>,
  await getTravelSettings()
)
