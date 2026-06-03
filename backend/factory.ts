import { ApprovedTravelsPrinter } from 'abrechnung-common/print/approvedTravelsPrinter.js'
import { ReportPrinter } from 'abrechnung-common/print/reportPrinter.js'
import { TravelCalculator } from 'abrechnung-common/travel/calculator.js'
import {
  _id,
  CountryCode,
  Country as ICountry,
  Locale,
  NameDisplayFormat,
  PrinterSettings,
  TravelSettings
} from 'abrechnung-common/types.js'
import { CurrencyConverter, ExchangeRateProviderWithLocalStorage } from 'abrechnung-common/utils/currencyConverter.js'
import { sources } from 'abrechnung-common/utils/exchangeRateSource.js'
import Formatter from 'abrechnung-common/utils/formatter.js'
import { Types } from 'mongoose'
import { BACKEND_CACHE } from './db.js'
import i18n from './i18n.js'
import Country from './models/country.js'
import DocumentFile from './models/documentFile.js'
import ExchangeRate from './models/exchangeRate.js'
import Organisation from './models/organisation.js'

function translateText(textIdentifier: string, language: Locale, interpolation?: Record<string, string>) {
  return i18n.t(textIdentifier, { lng: language, ...interpolation }) as string
}

async function getDocumentFileBuffer(id: _id) {
  const doc = await DocumentFile.findOne({ _id: id }).lean()
  if (doc) {
    // inconsistent type in mongoose for Buffer, so need assertion here https://github.com/Automattic/mongoose/pull/15518
    return { buffer: doc.data.buffer as unknown as ArrayBuffer, type: doc.type }
  }
  return null
}

async function getOrganisationLogo(id: _id) {
  const orga = await Organisation.findOne({ _id: id }).lean()
  if (orga?.logo?._id) {
    return { logoId: orga.logo._id, website: orga.website }
  }
  return null
}

export function createFormatter(
  locale = BACKEND_CACHE.displaySettings.locale.default,
  nameDisplayFormat = BACKEND_CACHE.displaySettings.nameDisplayFormat
) {
  return new Formatter(locale, nameDisplayFormat)
}

export function createReportPrinter(
  settings: PrinterSettings = BACKEND_CACHE.printerSettings,
  travelSettings: TravelSettings = BACKEND_CACHE.travelSettings,
  nameDisplayFormat: NameDisplayFormat = BACKEND_CACHE.displaySettings.nameDisplayFormat
) {
  return new ReportPrinter<_id>(
    settings,
    travelSettings,
    createFormatter(undefined, nameDisplayFormat),
    translateText,
    getDocumentFileBuffer,
    getOrganisationLogo
  )
}

export function createApprovedTravelsPrinter(
  settings: PrinterSettings = BACKEND_CACHE.printerSettings,
  nameDisplayFormat: NameDisplayFormat = BACKEND_CACHE.displaySettings.nameDisplayFormat,
  allowSpouseRefund = BACKEND_CACHE.travelSettings.allowSpouseRefund
) {
  const printer = new ApprovedTravelsPrinter<Types.ObjectId>(
    settings,
    createFormatter(undefined, nameDisplayFormat),
    translateText,
    getDocumentFileBuffer,
    getOrganisationLogo
  )
  printer.setAllowSpouseRefund(allowSpouseRefund)
  return printer
}

export const formatter = createFormatter()

export const reportPrinter = createReportPrinter()

export const approvedTravelsPrinter = createApprovedTravelsPrinter()

export const travelCalculator = new TravelCalculator(
  (id: CountryCode) => Country.findOne({ _id: id }).lean() as Promise<ICountry>,
  BACKEND_CACHE.travelSettings
)

export const currencyConverter = new CurrencyConverter(BACKEND_CACHE.settings.exchangeRateProvider, [
  new ExchangeRateProviderWithLocalStorage(
    'InforEuro',
    sources.InforEuro,
    async (date, _TO, rates) => {
      if (rates.length === 0) {
        return
      }
      const cacheDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
      await ExchangeRate.bulkWrite(
        rates.map((rate) => ({
          updateOne: {
            filter: { provider: 'InforEuro', currency: rate.currency, date: cacheDate },
            update: { $setOnInsert: { ...rate, provider: 'InforEuro', date: cacheDate } },
            upsert: true
          }
        }))
      )
    },
    async (date, FROM, _TO) => {
      const cacheDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
      const rateDoc = await ExchangeRate.findOne({ provider: 'InforEuro', currency: FROM, date: cacheDate }).lean()
      if (rateDoc?.rate) {
        return 1 / rateDoc.rate
      }
      return null
    }
  ),
  new ExchangeRateProviderWithLocalStorage(
    'Frankfurter',
    sources.Frankfurter,
    async (date, TO, rates) => {
      if (TO !== 'EUR') {
        return
      }
      if (rates.length === 0) {
        return
      }
      const cacheDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
      await ExchangeRate.bulkWrite(
        rates.map((rate) => ({
          updateOne: {
            filter: { provider: 'Frankfurter', currency: rate.currency, date: cacheDate },
            update: { $setOnInsert: { ...rate, provider: 'Frankfurter', date: cacheDate } },
            upsert: true
          }
        }))
      )
    },
    async (date, FROM, TO) => {
      if (TO !== 'EUR') {
        return null
      }
      const cacheDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
      const rateDoc = await ExchangeRate.findOne({ provider: 'Frankfurter', currency: FROM, date: cacheDate }).lean()
      if (rateDoc?.rate) {
        return 1 / rateDoc.rate
      }
      return null
    }
  )
])
