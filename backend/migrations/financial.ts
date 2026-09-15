import { divideAmount, multiplyAmountAndRound, roundAmount, subtractAmounts, sumAmounts } from 'abrechnung-common/utils/scripts.js'

export interface LegacyExchangeRate {
  rate: number
  amount?: number | null
  date?: unknown
}

// Old releases stored both rate directions. The recorded EUR amount is the
// financial source of truth; a rate alone cannot establish its direction.
export function normalizeLegacyExchangeRate<T extends LegacyExchangeRate>(
  amount: number,
  exchangeRate: T | null | undefined,
  location: string
) {
  if (exchangeRate?.amount == null) return exchangeRate
  const euroAmount = exchangeRate.amount
  if (!Number.isFinite(amount) || !Number.isFinite(euroAmount)) {
    throw new Error(`Invalid legacy currency amounts at ${location}`)
  }
  const reproducesEuroAmount = (rate: number) =>
    Number.isFinite(rate) && rate > 0 && multiplyAmountAndRound(amount, rate) === roundAmount(euroAmount)
  if (reproducesEuroAmount(exchangeRate.rate)) return exchangeRate
  const rate = divideAmount(euroAmount, amount)
  if (!reproducesEuroAmount(rate)) {
    throw new Error(`Cannot preserve legacy EUR amount at ${location}`)
  }
  return { ...exchangeRate, rate }
}

export function convertLegacyAdvance<T extends LegacyExchangeRate>(
  advance: { budget: { amount: number; exchangeRate?: T | null }; balance: { amount: number }; offsetAgainst: { amount: number }[] },
  location: string
) {
  const exchangeRate = normalizeLegacyExchangeRate(advance.budget.amount, advance.budget.exchangeRate, `${location}/budget`)
  const euroAmounts = [advance.balance.amount, ...advance.offsetAgainst.map((offset) => offset.amount)]
  if (!euroAmounts.every(Number.isFinite)) throw new Error(`Invalid legacy advance amounts at ${location}`)
  const rate = exchangeRate?.rate
  if (euroAmounts.some((amount) => amount !== 0) && !(exchangeRate?.amount != null && rate && Number.isFinite(rate) && rate > 0)) {
    throw new Error(`Cannot migrate foreign-currency advance without recorded budget amounts at ${location}`)
  }

  const convert = (amount: number) => (rate ? roundAmount(divideAmount(amount, rate)) : 0)
  let balance = convert(advance.balance.amount)
  const offsets = advance.offsetAgainst.map((offset) => convert(offset.amount))
  const sourceBalanced = exchangeRate?.amount != null && roundAmount(sumAmounts(...euroAmounts)) === roundAmount(exchangeRate.amount)
  if (sourceBalanced) {
    const offsetSum = sumAmounts(...offsets)
    const difference = roundAmount(subtractAmounts(advance.budget.amount, sumAmounts(balance, offsetSum)))
    if (Math.abs(difference) > 0.01) throw new Error(`Legacy advance rounding difference exceeds 0.01 at ${location}`)
    if (difference !== 0) {
      // Keep a spent advance at zero; assign its rounding remainder to the last nonzero offset.
      if (advance.balance.amount !== 0) {
        balance = roundAmount(subtractAmounts(advance.budget.amount, offsetSum))
        if (balance < 0) throw new Error(`Legacy advance rounding would produce a negative balance at ${location}`)
      } else {
        let index = advance.offsetAgainst.length - 1
        while (index >= 0 && advance.offsetAgainst[index].amount === 0) index -= 1
        if (index < 0) throw new Error(`Legacy advance rounding has no offset to adjust at ${location}`)
        offsets[index] = roundAmount(sumAmounts(offsets[index], difference))
        if (offsets[index] < 0) throw new Error(`Legacy advance rounding would produce a negative offset at ${location}`)
      }
    }
  }
  return { exchangeRate, balance, offsets, sourceBalanced }
}
