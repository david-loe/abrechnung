import { baseCurrency, idDocumentToId, Money } from '../types.js'

const exchangeRateSources = ['InforEuro'] as const
type _ExchangeRateSource = (typeof exchangeRateSources)[number]

export type InforEuroResponse = Array<{
  country: string
  currency: string
  isoA3Code: string
  isoA2Code: string
  value: number
  comment: null | string
}>

export class ExchangeRateProvider {
  name: string
  getRate: (date: Date, FROM: string, TO: string) => Promise<number | null>

  constructor(name: string, getRate: ExchangeRateProvider['getRate']) {
    this.name = name
    this.getRate = getRate
  }
}

export class CurrencyConverter {
  source: string
  sources: Record<string, ExchangeRateProvider>

  constructor(source: string, sources: ExchangeRateProvider[]) {
    this.source = source
    this.sources = {} as Record<string, ExchangeRateProvider>
    for (const s of sources) {
      this.sources[s.name] = s
    }
  }

  async convert(
    date: Date | string | number,
    amount: number,
    from: string,
    to: string = baseCurrency._id
  ): Promise<{ date: Date; rate: number; amount: number } | null> {
    const FROM = from.toUpperCase()
    const TO = to.toUpperCase()
    if (FROM === TO) {
      return null
    }
    const provider = this.sources[this.source]
    if (!provider) {
      throw new Error(`No exchange rate provider found for source ${this.source}`)
    }
    let conversionDate = new Date(date)
    if (conversionDate.valueOf() - Date.now() > 0) {
      conversionDate = new Date()
    }
    const rate = await provider.getRate(conversionDate, FROM, TO)
    if (rate === null) {
      return null
    }

    const resultAmount = Math.round(amount * rate * 100) / 100

    return { date: conversionDate, rate, amount: resultAmount }
  }

  async addExchangeRate(costObject: Money, date: string | number | Date) {
    let exchangeRate = null

    if (costObject.amount !== null && costObject.amount > 0) {
      exchangeRate = await this.convert(date, costObject.amount, idDocumentToId(costObject.currency))
    }
    costObject.exchangeRate = exchangeRate
    return costObject
  }
}
