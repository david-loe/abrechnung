import {
  _id,
  Advance,
  ExpenseReport,
  HealthCareCost,
  idDocumentToId,
  Locale,
  reportIsAdvance,
  reportIsHealthCareCost,
  reportIsTravel,
  Travel
} from 'abrechnung-common/types.js'
import { getTotalBalance, sanitizeFilename } from 'abrechnung-common/utils/scripts.js'
import { formatter } from '../factory.js'
import i18n from '../i18n.js'
import Organisation from '../models/organisation.js'

export async function writeToDiskFilePath(report: Travel | ExpenseReport | HealthCareCost | Advance): Promise<string> {
  let path = '/reports/'
  let totalSum = ''
  formatter.setLocale(i18n.language as Locale)
  if (reportIsAdvance(report)) {
    path += 'advance/'
    totalSum = formatter.baseCurrency(report.budget.amount)
  } else {
    totalSum = formatter.baseCurrency(getTotalBalance(report.addUp))
    if (reportIsTravel(report)) {
      path += 'travel/'
    } else if (reportIsHealthCareCost(report)) {
      path += 'healthCareCost/'
    } else {
      path += 'expenseReport/'
    }
  }
  const org = await Organisation.findOne({ _id: idDocumentToId<_id>(report.project.organisation) })
  const subfolder = org ? org.subfolderPath : ''
  const filename = sanitizeFilename(
    `${report.project.identifier} ${formatter.name(report.owner.name, 'shortWithoutPoint')} - ${report.name} ${totalSum}.pdf`
  )
  path += subfolder + filename
  return path
}
