import { SuggestionSourceReportType, User } from 'abrechnung-common/types.js'
import { Types } from 'mongoose'
import { NotAllowedError, NotFoundError, ValidationClientError } from './controller/error.js'
import { checkIfUserIsProjectSupervisor } from './helper.js'
import ExpenseReport from './models/expenseReport.js'
import HealthCareCost from './models/healthCareCost.js'
import Travel from './models/travel.js'

export interface ExaminedReportContext {
  reportId: string
  sourceReportType: SuggestionSourceReportType
}

interface StoredReportContext {
  historic?: boolean
  owner: Types.ObjectId
  project: Types.ObjectId
}

async function loadReportContext({ reportId, sourceReportType }: ExaminedReportContext) {
  if (!Types.ObjectId.isValid(reportId)) throw new ValidationClientError('Invalid report context.')
  const _id = new Types.ObjectId(reportId)
  const options = { projection: { historic: 1, owner: 1, project: 1 } }
  let report: unknown
  if (sourceReportType === 'Travel') report = await Travel.collection.findOne({ _id }, options)
  if (sourceReportType === 'ExpenseReport') report = await ExpenseReport.collection.findOne({ _id }, options)
  if (sourceReportType === 'HealthCareCost') report = await HealthCareCost.collection.findOne({ _id }, options)
  if (!report) throw new NotFoundError('No report found')
  return report as StoredReportContext
}

export async function authorizeExaminedReport(context: ExaminedReportContext, user: User<Types.ObjectId>) {
  const access = { Travel: 'examine/travel', ExpenseReport: 'examine/expenseReport', HealthCareCost: 'examine/healthCareCost' } as const
  if (!user.access[access[context.sourceReportType]]) throw new NotAllowedError()
  const report = await loadReportContext(context)
  if (report.historic || !checkIfUserIsProjectSupervisor(user, report.project)) throw new NotAllowedError()
  return report
}
