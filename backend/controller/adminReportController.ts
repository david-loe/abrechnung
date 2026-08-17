import { Readable } from 'node:stream'
import { Get, Produces, Query, Request, Route, Security, Tags } from '@tsoa/runtime'
import { Advance, ExpenseReport, HealthCareCost, Locale, ReportModelName, State, Travel } from 'abrechnung-common/types.js'
import mongoose, { mongo, Types } from 'mongoose'
import { createOperationServices } from '../factory.js'
import { Controller } from './controller.js'
import { NotFoundError } from './error.js'
import { AuthenticatedExpressRequest } from './types.js'

type AdminReport =
  | Travel<Types.ObjectId, mongo.Binary>
  | ExpenseReport<Types.ObjectId, mongo.Binary>
  | HealthCareCost<Types.ObjectId, mongo.Binary>
  | Advance<Types.ObjectId>

async function getCurrentReport(type: ReportModelName, _id: string, printableOnly = false) {
  const filter = { _id, historic: false, ...(printableOnly ? { state: { $gte: State.BOOKABLE } } : {}) }
  const report = await mongoose.model<AdminReport>(type).findOne(filter, { history: 0, historic: 0 }).lean()
  if (!report) {
    throw new NotFoundError(`No current ${type} with id: '${_id}' found`)
  }
  return report
}

async function getCurrentReportPdf(controller: Controller, type: ReportModelName, _id: string, language: Locale) {
  const report = await getCurrentReport(type, _id, true)
  const pdf = await createOperationServices().reportPrinter.print(report, language)
  controller.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(report.name)}.pdf`)
  controller.setHeader('Content-Type', 'application/pdf')
  controller.setHeader('Content-Length', pdf.length)
  return Readable.from([pdf])
}

@Tags('Admin', 'Travel')
@Route('admin/travel')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class AdminTravelController extends Controller {
  @Get()
  public async get(@Query() _id: string) {
    return { data: await getCurrentReport('Travel', _id) }
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReport(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    return await getCurrentReportPdf(this, 'Travel', _id, request.user.settings.language)
  }
}

@Tags('Admin', 'Expense Report')
@Route('admin/expenseReport')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class AdminExpenseReportController extends Controller {
  @Get()
  public async get(@Query() _id: string) {
    return { data: await getCurrentReport('ExpenseReport', _id) }
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReport(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    return await getCurrentReportPdf(this, 'ExpenseReport', _id, request.user.settings.language)
  }
}

@Tags('Admin', 'Health Care Cost')
@Route('admin/healthCareCost')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class AdminHealthCareCostController extends Controller {
  @Get()
  public async get(@Query() _id: string) {
    return { data: await getCurrentReport('HealthCareCost', _id) }
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReport(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    return await getCurrentReportPdf(this, 'HealthCareCost', _id, request.user.settings.language)
  }
}

@Tags('Admin', 'Advance')
@Route('admin/advance')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class AdminAdvanceController extends Controller {
  @Get()
  public async get(@Query() _id: string) {
    return { data: await getCurrentReport('Advance', _id) }
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReport(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    return await getCurrentReportPdf(this, 'Advance', _id, request.user.settings.language)
  }
}
