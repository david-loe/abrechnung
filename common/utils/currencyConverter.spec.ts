import test from 'ava'
import { baseCurrency } from '../types.js'
import { CurrencyConverter, ExchangeRateProvider } from './currencyConverter.js'

test('CurrencyConverter.convert rounds exact half cents up with decimal multiplication', async (t) => {
  const converter = new CurrencyConverter('Test', [new ExchangeRateProvider('Test', async () => 0.5)])

  const result = await converter.convert(new Date('2024-01-01'), 2.01, 'USD', baseCurrency._id)

  t.truthy(result)
  if (!result) return
  t.is(result.amount, 1.01)
  t.is(result.rate, 0.5)
})

test('CurrencyConverter.convert does not push sub-half-cent products up', async (t) => {
  const converter = new CurrencyConverter('Test', [new ExchangeRateProvider('Test', async () => 1.0049999999999997)])

  const result = await converter.convert(new Date('2024-01-01'), 1, 'USD', baseCurrency._id)

  t.truthy(result)
  if (!result) return
  t.is(result.amount, 1)
})
