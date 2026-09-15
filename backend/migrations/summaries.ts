import { baseCurrency } from 'abrechnung-common/types.js'
import { sumAmounts } from 'abrechnung-common/utils/scripts.js'

interface LegacySummary {
  project?: unknown
  currency?: unknown
  expenses: { amount: number }
  total: { amount: number }
  balance: { amount: number }
  advance?: { amount: number }
  lumpSums?: { amount: number }
  negativeTotal?: boolean
  advanceOverflow?: boolean
}

export function migrateSummaries(summary: LegacySummary | LegacySummary[], project: unknown) {
  return (Array.isArray(summary) ? summary : [summary]).map((entry) => ({
    ...entry,
    project: entry.project ?? project,
    currency: entry.currency ?? baseCurrency._id,
    advance: entry.advance ?? { amount: 0 },
    negativeTotal: entry.negativeTotal ?? sumAmounts(entry.expenses.amount, entry.lumpSums?.amount ?? 0) < 0,
    advanceOverflow: entry.advanceOverflow ?? entry.total.amount < (entry.advance?.amount ?? 0)
  }))
}
