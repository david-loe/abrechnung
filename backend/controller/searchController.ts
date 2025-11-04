import {
  AdvanceState,
  ExpenseReportState,
  HealthCareCostState,
  IdDocument,
  idDocumentToId,
  Meta,
  ReportModelName,
  State,
  TravelState,
  User
} from 'abrechnung-common/types.js'
import mongoose, { FilterQuery } from 'mongoose'
import { Get, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { PaginationQuery } from './controller.js'
import { NotFoundError } from './error.js'
import { AuthenticatedExpressRequest } from './types.js'

interface SearchQuery extends PaginationQuery {
  term: string
}

@Tags('Search')
@Route('search')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class SearchController {
  @Get()
  public async get(@Queries() query: SearchQuery, @Request() request: AuthenticatedExpressRequest) {
    const meta: Meta = { limit: query.limit || 10, page: query.page || 1, count: 1, countPages: 1 }
    const result = await simpleSearch(query.term, getPermissionFilter(request.user), meta.limit, meta.page)
    meta.count = result.total
    if (meta.limit > 0) {
      meta.countPages = Math.ceil(meta.count / meta.limit)
    }
    return { data: result.rows, meta }
  }

  @Get('ref')
  public async getByRef(@Query() ref: number, @Query() type: ReportModelName, @Request() request: AuthenticatedExpressRequest) {
    const filter = getPermissionFilter(request.user)[type]
    filter['reference'] = ref
    const report = await mongoose.model(type).findOne(filter).lean()
    if (!report) {
      throw new NotFoundError(`No ${type} with ref: '${ref}' found or not allowed`)
    }
    return { data: report }
  }
}

function getPermissionFilter(user: User) {
  const permissionFilter = (states?: Set<number>, projects?: IdDocument[]) => {
    const ors: FilterQuery<unknown>[] = []
    if (states && states.size > 0) {
      ors.push({ state: { $in: Array.from(states) } })
    }
    if (projects && projects.length > 0) {
      const projectIds = projects.map((p) => idDocumentToId(p))
      ors.push({ project: { $in: projectIds } })
    }
    return { historic: false, $or: [{ owner: user._id }, ...ors] } as FilterQuery<unknown>
  }

  const travelStates = new Set<number>()
  if (user.access['approve/travel']) {
    travelStates.add(TravelState.APPLIED_FOR)
    travelStates.add(TravelState.APPROVED)
  }
  if (user.access['examine/travel']) {
    travelStates.add(TravelState.APPROVED)
    travelStates.add(TravelState.IN_REVIEW)
    travelStates.add(TravelState.REVIEW_COMPLETED)
  }
  if (user.access['book/travel']) {
    travelStates.add(State.BOOKABLE)
    travelStates.add(State.BOOKED)
  }

  const expenseReportStates = new Set<number>()
  if (user.access['examine/expenseReport']) {
    expenseReportStates.add(ExpenseReportState.IN_WORK)
    expenseReportStates.add(ExpenseReportState.IN_REVIEW)
    expenseReportStates.add(ExpenseReportState.REVIEW_COMPLETED)
  }
  if (user.access['book/expenseReport']) {
    expenseReportStates.add(State.BOOKABLE)
    expenseReportStates.add(State.BOOKED)
  }

  const healthCareCostStates = new Set<number>()
  if (user.access['examine/healthCareCost']) {
    healthCareCostStates.add(HealthCareCostState.IN_WORK)
    healthCareCostStates.add(HealthCareCostState.IN_REVIEW)
    healthCareCostStates.add(HealthCareCostState.REVIEW_COMPLETED)
  }
  if (user.access['book/healthCareCost']) {
    healthCareCostStates.add(State.BOOKABLE)
    healthCareCostStates.add(State.BOOKED)
  }

  const advanceStates = new Set<number>()
  if (user.access['approve/advance']) {
    advanceStates.add(AdvanceState.APPLIED_FOR)
    advanceStates.add(AdvanceState.APPROVED)
  }
  if (user.access['book/advance']) {
    advanceStates.add(State.BOOKABLE)
    advanceStates.add(State.BOOKED)
  }

  return {
    Travel: permissionFilter(travelStates, user.projects.supervised),
    ExpenseReport: permissionFilter(expenseReportStates, user.projects.supervised),
    HealthCareCost: permissionFilter(healthCareCostStates, user.projects.supervised),
    Advance: permissionFilter(advanceStates, user.projects.supervised)
  }
}

async function simpleSearch(termRaw: string, filter: Record<ReportModelName, FilterQuery<unknown>>, limit: number, page: number) {
  const term = termRaw.trim()
  const match = (reportModelName: ReportModelName) => ({ $match: { $text: { $search: term }, ...filter[reportModelName] } })
  const pipeline = [
    match('Travel'),
    { $addFields: { _reportModelName: 'Travel' } },
    { $unionWith: { coll: 'expensereports', pipeline: [match('ExpenseReport'), { $addFields: { _reportModelName: 'ExpenseReport' } }] } },
    {
      $unionWith: { coll: 'healthcarecosts', pipeline: [match('HealthCareCost'), { $addFields: { _reportModelName: 'HealthCareCost' } }] }
    },
    { $unionWith: { coll: 'advances', pipeline: [match('Advance'), { $addFields: { _reportModelName: 'Advance' } }] } },
    { $project: { name: 1, _id: 1, score: { $meta: 'textScore' }, _reportModelName: 1 } },
    { $sort: { score: -1 } },
    { $facet: { rows: [{ $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: 'total' }] } },
    { $project: { rows: 1, total: { $ifNull: [{ $arrayElemAt: ['$count.total', 0] }, 0] } } }
  ]
  console.log(JSON.stringify(pipeline))
  const result = (await mongoose.connection.collection('travels').aggregate(pipeline).toArray())[0] as { rows: unknown[]; total: number }
  return result
}
