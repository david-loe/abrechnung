import { ApprovedTravelsPrinter } from 'abrechnung-common/print/approvedTravelsPrinter.js'
import { ReportPrinter } from 'abrechnung-common/print/reportPrinter.js'
import { TravelCalculator } from 'abrechnung-common/travel/calculator.js'
import { CountryCode, Country as ICountry, ExchangeRate as IExchangeRate, Locale } from 'abrechnung-common/types.js'
import { CurrencyConverter, ExchangeRateProvider, InforEuroResponse } from 'abrechnung-common/utils/currencyConverter.js'
import Formatter from 'abrechnung-common/utils/formatter.js'
import axios from 'axios'
import { Types } from 'mongoose'
import { getDisplaySettings, getPrinterSettings, getTravelSettings } from './db.js'
import i18n from './i18n.js'
import Country from './models/country.js'
import DocumentFile from './models/documentFile.js'
import ExchangeRate from './models/exchangeRate.js'
import Organisation from './models/organisation.js'

const displaySettings = await getDisplaySettings(false)
export const formatter = new Formatter(displaySettings.locale.default, displaySettings.nameDisplayFormat)

const printerSettings = await getPrinterSettings(false)
const travelSettings = await getTravelSettings(false)
export const reportPrinter = new ReportPrinter<Types.ObjectId>(
  printerSettings,
  travelSettings,
  formatter,
  (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => {
    return i18n.t(textIdentifier, { lng: language, ...interpolation }) as string
  },
  async (id) => {
    const doc = await DocumentFile.findOne({ _id: id }).lean()
    if (doc) {
      // inconsistent type in mongoose for Buffer, so need assertion here https://github.com/Automattic/mongoose/pull/15518
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
      // inconsistent type in mongoose for Buffer, so need assertion here https://github.com/Automattic/mongoose/pull/15518
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
  await getTravelSettings(false)
)

export const currencyConverter = new CurrencyConverter('InforEuro', [
  new ExchangeRateProvider('InforEuro', async (date, FROM, TO) => {
    if (TO !== 'EUR') {
      return null
    }
    const month = date.getUTCMonth() + 1
    const year = date.getUTCFullYear()
    let data: IExchangeRate | null | undefined = await ExchangeRate.findOne({ currency: FROM, month: month, year: year }).lean()
    if (!data && !(await ExchangeRate.findOne({ month: month, year: year }).lean())) {
      const res = await axios.get(`https://ec.europa.eu/budg/inforeuro/api/public/monthly-rates?lang=EN&year=${year}&month=${month}`)
      if (res.status === 200) {
        const rates = (res.data as InforEuroResponse).map(
          (r) => ({ currency: r.isoA3Code, value: r.value, month: month, year: year }) as IExchangeRate
        )
        await ExchangeRate.insertMany(rates)
        data = rates.find((r) => r.currency === FROM)
      }
    }
    if (!data?.value) {
      return null
    }
    return 1 / data.value
  })
])
