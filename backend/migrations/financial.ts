import { divideAmount, multiplyAmountAndRound, roundAmount } from 'abrechnung-common/utils/scripts.js'

export interface LegacyExchangeRate {
  rate: number
  amount?: number | null
  date?: unknown
}

// Old releases stored both rate directions. The recorded EUR amount is the
// financial source of truth; a rate alone cannot establish its direction.
export function normalizeLegacyExchangeRate(amount: number, exchangeRate: LegacyExchangeRate | null | undefined, location: string) {
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
