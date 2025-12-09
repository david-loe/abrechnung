import mongoose from 'mongoose'
import { Get, Query, Route, Tags } from 'tsoa'
import ReportUsage from '../models/reportUsage.js'
import { Controller } from './controller.js'
import { NotFoundError } from './error.js'

@Tags('Stats')
@Route()
export class StatsController extends Controller {
  @Get('health')
  public async get() {
    return { status: 'ok', db: mongoose.ConnectionStates[mongoose.connection.readyState] }
  }

  @Get('stats/dbUsage')
  public async getDBUsage() {
    return await getDBUsage()
  }

  @Get('stats/reportUsage')
  public async getReportUsage(@Query() from: Date, @Query() to: Date) {
    return { reportUsage: await getReportUsage(from, to), from, to }
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
    { $match: { createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: '$reportModelName', count: { $sum: 1 } } }
  ])
  for (const r of result) {
    reportUsage[r._id as keyof typeof reportUsage] = r.count
  }
  return reportUsage
}
