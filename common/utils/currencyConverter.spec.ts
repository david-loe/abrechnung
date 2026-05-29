import test from 'ava'
import { baseCurrency } from '../types.js'
import { CurrencyConverter, ExchangeRateProvider } from './currencyConverter.js'

test('CurrencyConverter.convert uses exchange rates as foreign currency per EUR', async (t) => {
  const converter = new CurrencyConverter('Test', [new ExchangeRateProvider('Test', async () => 2)])

  const result = await converter.convert(new Date('2024-01-01'), 10, 'USD', baseCurrency._id)

  t.truthy(result)
  if (!result) return
  t.is(result.amount, 5)
  t.is(result.rate, 2)
})

test('CurrencyConverter.convert rounds exact half cents up with decimal division', async (t) => {
  const converter = new CurrencyConverter('Test', [new ExchangeRateProvider('Test', async () => 2)])

  const result = await converter.convert(new Date('2024-01-01'), 2.01, 'USD', baseCurrency._id)

  t.truthy(result)
  if (!result) return
  t.is(result.amount, 1.01)
  t.is(result.rate, 2)
})

test('CurrencyConverter.convert does not push sub-half-cent quotients up', async (t) => {
  const converter = new CurrencyConverter('Test', [new ExchangeRateProvider('Test', async () => 2)])

  const result = await converter.convert(new Date('2024-01-01'), 2.009, 'USD', baseCurrency._id)

  t.truthy(result)
  if (!result) return
  t.is(result.amount, 1)
})
