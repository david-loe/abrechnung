import test from 'ava'
import { baseCurrency } from '../types.js'
import { CurrencyConverter, ExchangeRateProvider, ExchangeRateProviderWithLocalStorage, GetRateFn, Rates } from './currencyConverter.js'

function providerWithRate(rate: number | null) {
  return new ExchangeRateProvider('InforEuro', async () => ({ rate, rates: null }))
}

test('CurrencyConverter.convert rounds exact half cents up with decimal multiplication', async (t) => {
  const converter = new CurrencyConverter('InforEuro', [providerWithRate(0.5)])

  const result = await converter.convert(new Date('2024-01-01'), 2.01, 'USD', baseCurrency._id)

  t.truthy(result)
  if (!result) return
  t.is(result.amount, 1.01)
  t.is(result.rate, 0.5)
})

test('CurrencyConverter.convert does not push sub-half-cent products up', async (t) => {
  const converter = new CurrencyConverter('InforEuro', [providerWithRate(1.0049999999999997)])

  const result = await converter.convert(new Date('2024-01-01'), 1, 'USD', baseCurrency._id)

  t.truthy(result)
  if (!result) return
  t.is(result.amount, 1)
})

test('CurrencyConverter.convert uses the selected provider', async (t) => {
  const converter = new CurrencyConverter('InforEuro', [
    new ExchangeRateProvider('InforEuro', async () => ({ rate: 0.5, rates: null })),
    new ExchangeRateProvider('Frankfurter', async () => ({ rate: 0.25, rates: null }))
  ])

  converter.setProvider('Frankfurter')
  const result = await converter.convert(new Date('2024-01-01'), 4, 'USD', baseCurrency._id)

  t.truthy(result)
  if (!result) return
  t.is(result.amount, 1)
  t.is(result.rate, 0.25)
})

test('CurrencyConverter throws when selected provider is unavailable', (t) => {
  t.throws(() => new CurrencyConverter('Frankfurter', [providerWithRate(0.5)]), {
    message: 'No exchange rate provider found for provider Frankfurter'
  })
})

test('ExchangeRateProviderWithLocalStorage returns stored rates without fetching', async (t) => {
  let fetched = false
  const provider = new ExchangeRateProviderWithLocalStorage(
    'InforEuro',
    async () => {
      fetched = true
      return { rate: 0.5, rates: null }
    },
    async () => {
      throw new Error('storeRates should not be called')
    },
    async () => 0.25
  )

  const result = await provider.getRate(new Date('2024-01-01'), 'USD', 'EUR')

  t.false(fetched)
  t.deepEqual(result, { rate: 0.25, rates: null })
})

test('ExchangeRateProviderWithLocalStorage stores fetched rates', async (t) => {
  const rates: Rates = [{ currency: 'USD', rate: 1.1 }]
  let stored: { date: Date; to: string; rates: Rates } | null = null
  const getRate: GetRateFn = async () => ({ rate: 1 / 1.1, rates })
  const date = new Date('2024-01-01')
  const provider = new ExchangeRateProviderWithLocalStorage(
    'InforEuro',
    getRate,
    async (storeDate, to, storeRates) => {
      stored = { date: storeDate, to, rates: storeRates }
    },
    async () => null
  )

  const result = await provider.getRate(date, 'USD', 'EUR')

  t.deepEqual(result, { rate: 1 / 1.1, rates })
  t.deepEqual(stored, { date, to: 'EUR', rates })
})
