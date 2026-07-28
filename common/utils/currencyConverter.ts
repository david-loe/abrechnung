import { baseCurrency, Cost, CurrencyCode, ExchangeRateProviderName, IdDocument, idDocumentToId } from '../types.js'
import { multiplyAmountAndRound } from './scripts.js'

export type Rates = { currency: CurrencyCode; rate: number }[]
export type GetRateFn = (date: Date, FROM: string, TO: string) => Promise<{ rate: number | null; rates: Rates | null }>

export class ExchangeRateProvider {
  name: ExchangeRateProviderName
  #getRate: GetRateFn

  constructor(name: ExchangeRateProviderName, getRate: GetRateFn) {
    this.name = name
    this.#getRate = getRate
  }

  async getRate(date: Date, FROM: string, TO: string) {
    return this.#getRate(date, FROM, TO)
  }
}

export class ExchangeRateProviderWithLocalStorage extends ExchangeRateProvider {
  storeRates: (date: Date, TO: string, rates: Rates) => Promise<void>
  getStoredRate: (date: Date, FROM: string, TO: string) => Promise<number | null>

  constructor(
    name: ExchangeRateProviderName,
    getRate: GetRateFn,
    storeRates: ExchangeRateProviderWithLocalStorage['storeRates'],
    getStoredRate: ExchangeRateProviderWithLocalStorage['getStoredRate']
  ) {
    super(name, getRate)
    this.storeRates = storeRates
    this.getStoredRate = getStoredRate
  }

  async getRate(date: Date, FROM: string, TO: string) {
    const storedRate = await this.getStoredRate(date, FROM, TO)
    if (storedRate) {
      return { rate: storedRate, rates: null }
    } else {
      const result = await super.getRate(date, FROM, TO)
      if (result.rates) {
        await this.storeRates(date, TO, result.rates)
      }
      return result
    }
  }
}

export class CurrencyConverter {
  #provider!: ExchangeRateProviderName
  #providers: Partial<Record<ExchangeRateProviderName, ExchangeRateProvider>>

  constructor(provider: ExchangeRateProviderName, providers: ExchangeRateProvider[]) {
    this.#providers = {}
    for (const s of providers) {
      this.#providers[s.name] = s
    }
    this.setProvider(provider)
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
    const provider = this.#getProvider(this.#provider)
    let conversionDate = new Date(date)
    if (conversionDate.valueOf() - Date.now() > 0) {
      conversionDate = new Date()
    }
    const rate = (await provider.getRate(conversionDate, FROM, TO)).rate
    if (rate === null) {
      return null
    }

    const resultAmount = multiplyAmountAndRound(amount, rate)

    return { date: conversionDate, rate, amount: resultAmount }
  }

  async addExchangeRate<
    M extends {
      amount: number | null
      currency: IdDocument<CurrencyCode>
      exchangeRate?: { date: Date | string; rate: number; amount: number } | null | undefined
    }
  >(costObject: M, date: string | number | Date) {
    let exchangeRate = null

    if (costObject.amount !== null && costObject.amount !== 0) {
      exchangeRate = await this.convert(date, costObject.amount, idDocumentToId(costObject.currency))
    }
    costObject.exchangeRate = exchangeRate
    return costObject
  }

  async addCostExchangeRate<M extends Pick<Cost, 'currency' | 'exchangeRate'>>(cost: M, date: string | number | Date) {
    const conversion = await this.convert(date, 1, idDocumentToId(cost.currency))
    cost.exchangeRate = conversion ? { date: conversion.date, rate: conversion.rate } : null
    return cost
  }

  #getProvider(providerName: ExchangeRateProviderName) {
    if (!this.#providers[providerName]) {
      throw new Error(`No exchange rate provider found for provider ${providerName}`)
    }
    return this.#providers[providerName]
  }

  setProvider(providerName: ExchangeRateProviderName) {
    if (!this.#providers[providerName]) {
      throw new Error(`No exchange rate provider found for provider ${providerName}`)
    }
    this.#provider = providerName
  }
}
