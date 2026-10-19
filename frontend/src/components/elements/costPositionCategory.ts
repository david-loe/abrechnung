import { Category, Expense } from 'abrechnung-common/types.js'

export function getPositionCategory(
  categories: Category<string>[],
  reportType: 'Travel' | 'ExpenseReport',
  reportCategory?: Category<string>
) {
  if (reportCategory) return reportCategory
  const available = categories.filter(({ for: value }) => value === 'both' || value === reportType)
  return available.find(({ isDefault }) => isDefault) ?? (available.length === 1 ? available[0] : undefined)
}

export function replaceReportCategory(
  expenses: Expense<string>[],
  previousCategory?: Category<string> | null,
  nextCategory?: Category<string> | null
) {
  if (!previousCategory || !nextCategory || previousCategory._id === nextCategory._id) return []
  return expenses
    .filter(({ cost }) => cost.positions.some(({ category }) => category._id === previousCategory._id))
    .map((expense) => ({
      ...expense,
      cost: {
        ...expense.cost,
        positions: expense.cost.positions.map((position) =>
          position.category._id === previousCategory._id ? { ...position, category: nextCategory } : position
        )
      }
    }))
}
