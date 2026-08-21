import {
  type ActionAccess,
  type ActionCounts,
  AdvanceState,
  actionAccesses,
  ExpenseReportState,
  HealthCareCostState,
  TravelState,
  type User
} from 'abrechnung-common/types.js'
import { Model, PipelineStage, Types } from 'mongoose'
import Advance from './models/advance.js'
import ExpenseReport from './models/expenseReport.js'
import HealthCareCost from './models/healthCareCost.js'
import Travel from './models/travel.js'

interface CountDefinition {
  access: ActionAccess
  state: number
}

interface StateCount {
  _id: number
  count: number
}

const countDefinitions = {
  advance: [
    { access: 'approve/advance', state: AdvanceState.APPLIED_FOR },
    { access: 'book/advance', state: AdvanceState.APPROVED }
  ],
  travel: [
    { access: 'approve/travel', state: TravelState.APPLIED_FOR },
    { access: 'examine/travel', state: TravelState.IN_REVIEW },
    { access: 'book/travel', state: TravelState.REVIEW_COMPLETED }
  ],
  expenseReport: [
    { access: 'examine/expenseReport', state: ExpenseReportState.IN_REVIEW },
    { access: 'book/expenseReport', state: ExpenseReportState.REVIEW_COMPLETED }
  ],
  healthCareCost: [
    { access: 'examine/healthCareCost', state: HealthCareCostState.IN_REVIEW },
    { access: 'book/healthCareCost', state: HealthCareCostState.REVIEW_COMPLETED }
  ]
} as const satisfies Record<string, readonly CountDefinition[]>

async function countStates<ModelType>(model: Model<ModelType>, definitions: readonly CountDefinition[], user: User<Types.ObjectId>) {
  const allowedDefinitions = definitions.filter(({ access }) => user.access[access])
  if (allowedDefinitions.length === 0) return []

  const match: PipelineStage.Match['$match'] = { historic: false, state: { $in: allowedDefinitions.map(({ state }) => state) } }
  if (user.projects.supervised.length > 0) {
    match.project = { $in: user.projects.supervised }
  }

  const counts = await model.aggregate<StateCount>([{ $match: match }, { $group: { _id: '$state', count: { $sum: 1 } } }])
  const countsByState = new Map(counts.map(({ _id, count }) => [_id, count]))
  return allowedDefinitions.map(({ access, state }) => [access, countsByState.get(state) ?? 0] as const)
}

export async function getActionCounts(user: User<Types.ObjectId>) {
  const counts = Object.fromEntries(actionAccesses.map((access) => [access, 0])) as ActionCounts
  const results = await Promise.all([
    countStates(Advance, countDefinitions.advance, user),
    countStates(Travel, countDefinitions.travel, user),
    countStates(ExpenseReport, countDefinitions.expenseReport, user),
    countStates(HealthCareCost, countDefinitions.healthCareCost, user)
  ])

  for (const [access, count] of results.flat()) counts[access] = count
  return counts
}
