import { Expense, ExpenseReport } from 'abrechnung-common/types.js'
import API from '@/api.js'
import { replaceReportCategory } from '@/components/elements/costPositionCategory.js'

export async function saveExpense(parentId: string, expense: Partial<Expense>, endpointPrefix = '', showAlert = true) {
  const headers: Record<string, string> = expense.cost?.receipts?.length ? { 'Content-Type': 'multipart/form-data' } : {}
  return await API.setter<ExpenseReport<string>>(
    `${endpointPrefix}expenseReport/expense`,
    expense,
    { headers, params: { parentId } },
    showAlert
  )
}

export async function saveExpenseReportDetails(
  report: ExpenseReport<string>,
  updatedReport: Partial<ExpenseReport<string>>,
  endpointPrefix = ''
) {
  const expenses = replaceReportCategory(report.expenses, report.category, updatedReport.category)
  for (const expense of expenses) {
    const result = await saveExpense(report._id, expense, endpointPrefix)
    if (!result.ok) return result
  }
  return await API.setter<ExpenseReport<string>>(
    `${endpointPrefix}expenseReport${endpointPrefix === 'examine/' ? '' : '/inWork'}`,
    updatedReport
  )
}
