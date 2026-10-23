import { mock } from 'node:test'
import { exchangeRateProviderNames, ExchangeRate as IExchangeRate } from 'abrechnung-common/types.js'
import { sources } from 'abrechnung-common/utils/exchangeRateSource.js'
import { ExecutionContext } from 'ava'
import { AxiosError, AxiosResponse } from 'axios'
import ExchangeRate from '../models/exchangeRate.js'

const restorers: Array<() => Promise<void>> = []
let requestMocks: Array<() => void> = []

export function blockExchangeRateRequests() {
  if (requestMocks.length > 0) return
  requestMocks = exchangeRateProviderNames.map((provider) => {
    const replacement = mock.method(sources, provider, async (date: Date, from: string, to: string) => {
      if (date.valueOf() < Date.UTC(2000, 0, 1) || (provider === 'InforEuro' && to !== 'EUR')) {
        return { rate: null, rates: null }
      }
      throw new Error(`Unexpected ${provider} request: ${date.toISOString()} ${from}/${to}; seed an exchange-rate fixture`)
    })
    return () => replacement.mock.restore()
  })
}

export async function seedExchangeRates(fixtures: IExchangeRate[]) {
  const entries: Array<() => Promise<void>> = []
  const restore = async () => {
    while (entries.length > 0) await entries.pop()?.()
  }
  restorers.push(restore)
  for (const fixture of fixtures) {
    const date = new Date(fixture.date)
    date.setUTCHours(0, 0, 0, 0)
    if (fixture.provider === 'InforEuro') date.setUTCDate(1)
    const filter = { provider: fixture.provider, currency: fixture.currency, date }
    const original = await ExchangeRate.collection.findOne(filter)
    entries.push(async () => {
      if (original) await ExchangeRate.collection.replaceOne(filter, original, { upsert: true })
      else await ExchangeRate.collection.deleteOne(filter)
    })
    await ExchangeRate.updateOne(filter, { $set: { ...fixture, date } }, { upsert: true })
  }
  return restore
}

export async function restoreExchangeRates() {
  try {
    while (restorers.length > 0) await restorers.pop()?.()
  } finally {
    for (const restore of requestMocks) restore()
    requestMocks = []
  }
}

export function simulateExchangeRateOutage(t: ExecutionContext, kind: 'http' | 'timeout' | 'network' = 'http') {
  const cached = mock.method(ExchangeRate.collection, 'findOne', async () => null)
  const failures = exchangeRateProviderNames.map((provider) =>
    mock.method(sources, provider, async () => {
      throw new AxiosError(
        'Exchange-rate test outage',
        kind === 'timeout' ? 'ECONNABORTED' : kind === 'network' ? 'ECONNRESET' : 'ERR_BAD_RESPONSE',
        undefined,
        {},
        kind === 'http' ? ({ status: 522 } as AxiosResponse) : undefined
      )
    })
  )
  const restore = () => {
    cached.mock.restore()
    for (const failure of failures) failure.mock.restore()
  }
  t.teardown(restore)
  return restore
}
