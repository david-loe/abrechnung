import { mock } from 'node:test'
import { exchangeRateProviderNames } from 'abrechnung-common/types.js'
import { ExchangeRateProviderWithLocalStorage } from 'abrechnung-common/utils/currencyConverter.js'
import { sources as upstreamSources } from 'abrechnung-common/utils/exchangeRateSource.js'
import test from 'ava'
import { AxiosError, AxiosResponse } from 'axios'
import { sources } from '../exchangeRateSource.js'

for (const provider of exchangeRateProviderNames) {
  test.serial(`${provider} treats provider HTTP, network and timeout failures as unavailable`, async (t) => {
    for (const error of [
      new AxiosError('Provider timeout', 'ECONNABORTED', undefined, {}),
      new AxiosError('Connection reset', 'ECONNRESET', undefined, {}),
      new AxiosError('Deadline reached', 'ERR_CANCELED'),
      new AxiosError('Provider unavailable', 'ERR_BAD_RESPONSE', undefined, {}, { status: 522 } as AxiosResponse)
    ]) {
      const source = mock.method(upstreamSources, provider, async () => {
        throw error
      })
      try {
        t.deepEqual(await sources[provider](new Date('2024-01-01'), 'USD', 'EUR'), { rate: null, rates: null })
      } finally {
        source.mock.restore()
      }
    }
  })

  test.serial(`${provider} preserves successful results and propagates unexpected failures`, async (t) => {
    const result = { rate: 0.8, rates: [{ currency: 'USD', rate: 1.25 }] }
    const success = mock.method(upstreamSources, provider, async () => result)
    try {
      t.deepEqual(await sources[provider](new Date('2024-01-01'), 'USD', 'EUR'), result)
    } finally {
      success.mock.restore()
    }
    for (const error of [new TypeError('Invalid response'), new AxiosError('Invalid configuration', 'ERR_BAD_OPTION')]) {
      const failure = mock.method(upstreamSources, provider, async () => {
        throw error
      })
      try {
        await t.throwsAsync(sources[provider](new Date('2024-01-01'), 'USD', 'EUR'), { is: error })
      } finally {
        failure.mock.restore()
      }
    }
  })

  test.serial(`${provider} uses cached rates during outages and propagates cache errors`, async (t) => {
    const source = mock.method(upstreamSources, provider, async () => {
      throw new Error('Must not fetch a cached rate')
    })
    t.teardown(() => source.mock.restore())
    const cacheFailure = new Error('Database unavailable')
    const converter = new ExchangeRateProviderWithLocalStorage(
      provider,
      sources[provider],
      async () => {
        throw new Error('Must not write a cached rate')
      },
      async () => 0.8
    )
    t.deepEqual(await converter.getRate(new Date('2024-01-01'), 'USD', 'EUR'), { rate: 0.8, rates: null })
    t.is(source.mock.callCount(), 0)
    converter.getStoredRate = async () => {
      throw cacheFailure
    }
    await t.throwsAsync(converter.getRate(new Date('2024-01-01'), 'USD', 'EUR'), { is: cacheFailure })
  })
}
