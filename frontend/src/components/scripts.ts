import { AdvanceBase, idDocumentToId, Report } from 'abrechnung-common/types.js'
import { getAdvances } from '@/components/advance/scripts.js'

interface ReportWithAdvance extends Report<string> {
  advances: AdvanceBase<string>[]
}

export async function getHasUnusedAdvances(expenseReport: ReportWithAdvance, endpointPrefix: string) {
  const availableAdvances = await getAdvances(idDocumentToId(expenseReport.owner), endpointPrefix)
  const advancesForProject = availableAdvances.filter((a) => a.project._id === idDocumentToId(expenseReport.project))
  return advancesForProject.some((pa) => !expenseReport.advances.some((ea) => idDocumentToId(ea) === idDocumentToId(pa)))
}
