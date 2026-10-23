import { once } from 'node:events'
import { createServer } from 'node:http'
import test, { ExecutionContext } from 'ava'
import axios, { AxiosRequestConfig } from 'axios'
import { sources } from './exchangeRateSource.js'

function stubAxiosGet(t: ExecutionContext, handler: (url: string, config: AxiosRequestConfig) => unknown) {
  const originalGet = axios.get
  axios.get = (async (url: string, config: AxiosRequestConfig) => handler(url, config)) as never
  t.teardown(() => {
    axios.get = originalGet
  })
}

test.serial('InforEuro source fetches monthly rates and returns inverted EUR rate', async (t) => {
  stubAxiosGet(t, (url) => {
    t.is(url, 'https://ec.europa.eu/budg/inforeuro/api/public/monthly-rates?lang=EN&year=2024&month=2')
    return {
      status: 200,
      data: [
        { country: 'United States', currency: 'US dollar', isoA3Code: 'USD', isoA2Code: 'US', value: 1.1, comment: null },
        { country: 'Switzerland', currency: 'Swiss franc', isoA3Code: 'CHF', isoA2Code: 'CH', value: 0.95, comment: null }
      ]
    }
  })

  const result = await sources.InforEuro(new Date('2024-02-15T12:00:00Z'), 'USD', 'EUR')

  t.is(result.rate, 1 / 1.1)
  t.deepEqual(result.rates, [
    { currency: 'USD', rate: 1.1 },
    { currency: 'CHF', rate: 0.95 }
  ])
})

test.serial('InforEuro source only supports conversion to EUR', async (t) => {
  let fetched = false
  stubAxiosGet(t, () => {
    fetched = true
    return { status: 200, data: [] }
  })

  const result = await sources.InforEuro(new Date('2024-02-15T12:00:00Z'), 'USD', 'CHF')

  t.false(fetched)
  t.deepEqual(result, { rate: null, rates: null })
})

test.serial('Frankfurter source fetches daily rates and returns inverted rate', async (t) => {
  stubAxiosGet(t, (url) => {
    t.is(url, 'https://api.frankfurter.dev/v2/rates?date=2024-02-15&base=EUR')
    return {
      status: 200,
      data: [
        { date: '2024-02-15', base: 'EUR', quote: 'USD', rate: 1.08 },
        { date: '2024-02-15', base: 'EUR', quote: 'CHF', rate: 0.95 }
      ]
    }
  })

  const result = await sources.Frankfurter(new Date('2024-02-15T12:00:00Z'), 'CHF', 'EUR')

  t.is(result.rate, 1 / 0.95)
  t.deepEqual(result.rates, [
    { currency: 'USD', rate: 1.08 },
    { currency: 'CHF', rate: 0.95 }
  ])
})

test.serial('Frankfurter source returns null rate when currency is missing', async (t) => {
  stubAxiosGet(t, () => ({ status: 200, data: [{ date: '2024-02-15', base: 'EUR', quote: 'USD', rate: 1.08 }] }))

  const result = await sources.Frankfurter(new Date('2024-02-15T12:00:00Z'), 'CHF', 'EUR')

  t.is(result.rate, null)
  t.deepEqual(result.rates, [{ currency: 'USD', rate: 1.08 }])
})

for (const provider of ['Frankfurter', 'InforEuro'] as const) {
  test.serial(`${provider} cancels a stalled request after five seconds`, async (t) => {
    const server = createServer(() => {})
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing server address')
    t.teardown(() => {
      server.closeAllConnections()
      server.close()
    })
    const originalGet = axios.get
    stubAxiosGet(t, (_url, config) => {
      t.is(config.timeout, 5_000)
      t.truthy(config.signal)
      return originalGet(`http://127.0.0.1:${address.port}`, { ...config, proxy: false })
    })
    const started = performance.now()
    const error = await t.throwsAsync(sources[provider](new Date('2024-02-15'), 'USD', 'EUR'))
    t.true(axios.isAxiosError(error))
    t.true(performance.now() - started < 7_000)
  })
}
