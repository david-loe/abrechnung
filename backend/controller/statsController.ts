import { datetimeToDate, isValidDate } from 'abrechnung-common/utils/scripts.js'
import mongoose from 'mongoose'
import { Body, Get, Post, Queries, Route, Security, Tags } from 'tsoa'
import { BACKEND_CACHE } from '../db.js'
import ReportUsage from '../models/reportUsage.js'
import Settings from '../models/settings.js'
import { Controller } from './controller.js'
import { ClientError, NotFoundError } from './error.js'

interface ReportUsageQuery {
  /**
   * @isDate
   */
  from: Date
  /**
   * @isDate
   */
  to: Date
}

@Tags('Stats')
@Route()
export class StatsController extends Controller {
  @Get('health')
  public async get() {
    return { status: 'ok', db: mongoose.ConnectionStates[mongoose.connection.readyState] }
  }

  @Get('stats/dbUsage')
  @Security('cookieAuth', ['admin'])
  @Security('httpBearer', ['admin'])
  @Security('usageToken')
  public async getDBUsage() {
    return { data: await getDBUsage() }
  }

  @Get('stats/reportUsage')
  @Security('cookieAuth', ['admin'])
  @Security('httpBearer', ['admin'])
  @Security('usageToken')
  public async getReportUsage(@Queries() q: ReportUsageQuery) {
    const from = datetimeToDate(q.from)
    const to = new Date(datetimeToDate(q.to).valueOf() + 86_400_000 - 1) // include whole day
    if (!isValidDate(from) || !isValidDate(to) || from > to) {
      throw new ClientError('Invalid dates')
    }
    return { data: { reportUsage: await getReportUsage(from, to), from, to } }
  }

  @Post('readOnly')
  @Security('usageToken')
  public async postReadOnly(@Body() requestBody: { isReadOnly: boolean }) {
    return await this.setter(Settings, { requestBody: { _id: BACKEND_CACHE.settings._id, ...requestBody }, allowNew: false })
  }
}

async function getDBUsage(scale?: number) {
  const dbUsage = await mongoose.connection.db?.command({ dbStats: 1, scale })
  if (!dbUsage) {
    throw new NotFoundError('No database stats available')
  }
  return {
    totalSize: dbUsage.totalSize as number,
    scale: dbUsage.scaleFactor as number,
    fsUsedSize: dbUsage.fsUsedSize as number,
    fsTotalSize: dbUsage.fsTotalSize as number
  }
}

async function getReportUsage(from: Date, to: Date) {
  const reportUsage = { ExpenseReport: 0, Travel: 0, HealthCareCost: 0, Advance: 0 }
  const result = await ReportUsage.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: '$reportModelName', count: { $sum: 1 } } }
  ])
  for (const r of result) {
    reportUsage[r._id as keyof typeof reportUsage] = r.count
  }
  return reportUsage
}
