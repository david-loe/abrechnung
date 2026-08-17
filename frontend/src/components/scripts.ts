import { AdvanceBase, Currency, idDocumentToId, Report } from 'abrechnung-common/types.js'
import { getAdvances } from '@/components/advance/scripts.js'

interface ReportWithAdvance extends Report<string> {
  advances: AdvanceBase<string>[]
  currency?: Currency | null
}

export async function getHasUnusedAdvances(expenseReport: ReportWithAdvance, endpointPrefix: string) {
  const availableAdvances = await getAdvances(idDocumentToId(expenseReport.owner), endpointPrefix)
  const advancesForProject = availableAdvances.filter(
    (advance) =>
      advance.project._id === idDocumentToId(expenseReport.project) &&
      (!expenseReport.currency || idDocumentToId(advance.budget.currency) === idDocumentToId(expenseReport.currency))
  )
  return advancesForProject.some((pa) => !expenseReport.advances.some((ea) => idDocumentToId(ea) === idDocumentToId(pa)))
}
