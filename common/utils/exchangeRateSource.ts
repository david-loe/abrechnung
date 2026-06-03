import axios from 'axios'
import { CurrencyCode, ExchangeRateProviderName } from '../types.js'
import { GetRateFn, Rates } from './currencyConverter.js'
import { datetimeToDateString } from './scripts.js'

type InforEuroResponse = Array<{
  country: string
  currency: string
  isoA3Code: string
  isoA2Code: string
  value: number
  comment: null | string
}>

type FrankfurterResponse = Array<{ date: string; base: string; quote: string; rate: number }>

export const sources: Record<ExchangeRateProviderName, GetRateFn> = {
  InforEuro: async (date: Date, FROM: CurrencyCode, TO: CurrencyCode) => {
    const result: { rate: number | null; rates: Rates | null } = { rate: null, rates: null }
    if (TO !== 'EUR') {
      return result
    }
    const month = date.getUTCMonth() + 1
    const year = date.getUTCFullYear()

    const res = await axios.get<InforEuroResponse>(
      `https://ec.europa.eu/budg/inforeuro/api/public/monthly-rates?lang=EN&year=${year}&month=${month}`
    )
    if (res.status === 200) {
      result.rates = res.data.map((r) => ({ currency: r.isoA3Code, rate: r.value }))
      const currency = result.rates.find((r) => r.currency === FROM)
      if (currency?.rate) {
        result.rate = 1 / currency.rate
      }
    }
    return result
  },
  Frankfurter: async (date: Date, FROM: CurrencyCode, TO: CurrencyCode) => {
    const result: { rate: number | null; rates: Rates | null } = { rate: null, rates: null }
    const res = await axios.get<FrankfurterResponse>(`https://api.frankfurter.dev/v2/rates?date=${datetimeToDateString(date)}&base=${TO}`)
    if (res.status === 200) {
      result.rates = res.data.map((r) => ({ currency: r.quote, rate: r.rate }))
      const currency = result.rates.find((r) => r.currency === FROM)
      if (currency?.rate) {
        result.rate = 1 / currency.rate
      }
    }
    return result
  }
}
