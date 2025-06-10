import { Readable } from 'node:stream'
import { Condition } from 'mongoose'
import { Body, Delete, Get, Middlewares, Post, Produces, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { _id, Expense, ExpenseReportState, IdDocument, ExpenseReport as IExpenseReport, Locale, State } from '../../common/types.js'
import { reportPrinter } from '../factory.js'
import { checkIfUserIsProjectSupervisor, documentFileHandler, fileHandler, writeToDisk } from '../helper.js'
import i18n from '../i18n.js'
import ExpenseReport, { ExpenseReportDoc } from '../models/expenseReport.js'
import User from '../models/user.js'
import { sendNotification } from '../notifications/notification.js'
import { sendViaMail, writeToDiskFilePath } from '../pdf/helper.js'
import { Controller, checkOwner, GetterQuery, SetterBody } from './controller.js'
import { AuthorizationError, NotFoundError } from './error.js'
import { AuthenticatedExpressRequest } from './types.js'

@Tags('Expense Report')
@Route('expenseReport')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class ExpenseReportController extends Controller {
  @Get()
  public async getOwn(@Queries() query: GetterQuery<IExpenseReport>, @Request() request: AuthenticatedExpressRequest) {
    return await this.getter(ExpenseReport, {
      query,
      filter: { owner: request.user._id, historic: false },
      projection: { history: 0, historic: 0, expenses: 0, bookingRemark: 0 },
      allowedAdditionalFields: ['expenses'],
      sort: { createdAt: -1 }
    })
  }
  @Delete()
  public async deleteOwn(@Query() _id: _id, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleter(ExpenseReport, { _id: _id, checkOldObject: checkOwner(request.user) })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  public async postExpenseToOwn(
    @Query('parentId') parentId: _id,
    @Body() requestBody: SetterBody<Expense>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    // multipart/form-data does not send null values
    // so we need to set it to null if the value is an empty string
    if (requestBody.project?.toString() === '') {
      requestBody.project = null
    }
    return await this.setterForArrayElement(ExpenseReport, {
      requestBody,
      parentId,
      arrayElementKey: 'expenses',
      allowNew: true,
      async checkOldObject(oldObject: ExpenseReportDoc) {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          await documentFileHandler(['cost', 'receipts'])(request)
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      },
      sortFn: (a: Expense, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpenseFromOwn(@Query() _id: _id, @Query() parentId: _id, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(ExpenseReport, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      async checkOldObject(oldObject: ExpenseReportDoc) {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      }
    })
  }

  @Post('inWork')
  public async postOwnInWork(
    @Body() requestBody: { project?: IdDocument; _id?: _id; name?: string; advances?: IdDocument[]; category?: IdDocument },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, {
      state: ExpenseReportState.IN_WORK,
      editor: request.user._id
    })

    if (!extendedBody._id) {
      if (!request.user.access['inWork:expenseReport']) {
        throw new AuthorizationError()
      }
      Object.assign(extendedBody, { owner: request.user._id })
      if (!extendedBody.name) {
        const date = new Date()
        extendedBody.name = `${i18n.t('labels.expenses', { lng: request.user.settings.language })} ${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
    }
    return await this.setter(ExpenseReport, {
      requestBody: extendedBody,
      async checkOldObject(oldObject: ExpenseReportDoc) {
        if (oldObject.owner._id.equals(request.user._id)) {
          if (oldObject.state === ExpenseReportState.IN_WORK && request.user.access['inWork:expenseReport']) {
            return true
          }
          if (oldObject.state === ExpenseReportState.IN_REVIEW && oldObject.editor._id.equals(request.user._id)) {
            await oldObject.saveToHistory()
            return true
          }
        }
        return false
      },
      allowNew: true
    })
  }

  @Post('underExamination')
  public async postOwnUnderExamination(
    @Body() requestBody: { _id: _id; comment?: string },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: ExpenseReportState.IN_REVIEW, editor: request.user._id })

    return await this.setter(ExpenseReport, {
      requestBody: extendedBody,
      cb: sendNotification,
      allowNew: false,
      async checkOldObject(oldObject: ExpenseReportDoc) {
        if (oldObject.owner._id.equals(request.user._id) && oldObject.state === ExpenseReportState.IN_WORK) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReportForOwn(@Query() _id: _id, @Request() request: AuthenticatedExpressRequest) {
    const expenseReport = await ExpenseReport.findOne({
      _id: _id,
      owner: request.user._id,
      historic: false,
      state: { $gte: State.BOOKABLE }
    }).lean()
    if (!expenseReport) {
      throw new NotFoundError(`No expense report with id: '${_id}' found or not allowed`)
    }
    const report = await reportPrinter.print(expenseReport, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(expenseReport.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }

  @Get('examiner')
  public async getExaminer() {
    return await this.getter(User, {
      query: { limit: 5 },
      filter: { 'access.examine/expenseReport': true },
      projection: { name: 1, email: 1 }
    })
  }
}

@Tags('Expense Report')
@Route('examine/expenseReport')
@Security('cookieAuth', ['examine/expenseReport'])
@Security('httpBearer', ['examine/expenseReport'])
export class ExpenseReportExamineController extends Controller {
  @Get()
  public async getToExamine(@Queries() query: GetterQuery<IExpenseReport>, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<IExpenseReport> = {
      historic: false
    }
    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    return await this.getter(ExpenseReport, {
      query,
      filter,
      projection: { history: 0, historic: 0, expenses: 0 },
      allowedAdditionalFields: ['expenses'],
      sort: { updatedAt: -1 }
    })
  }

  @Delete()
  public async delete(@Query() _id: _id, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleter(ExpenseReport, {
      _id: _id,
      async checkOldObject(oldObject: ExpenseReportDoc) {
        return checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
      }
    })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  public async postExpenseToAny(
    @Query('parentId') parentId: _id,
    @Body() requestBody: SetterBody<Expense>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    // multipart/form-data does not send null values
    // so we need to set it to null if the value is an empty string
    if (requestBody.project?.toString() === '') {
      requestBody.project = null
    }
    return await this.setterForArrayElement(ExpenseReport, {
      requestBody,
      parentId,
      arrayElementKey: 'expenses',
      allowNew: true,
      async checkOldObject(oldObject: ExpenseReportDoc) {
        if (
          !oldObject.historic &&
          (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
          checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
        ) {
          await documentFileHandler(['cost', 'receipts'], { owner: oldObject.owner._id })(request)
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      },
      sortFn: (a: Expense, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpenseFromAny(@Query() _id: _id, @Query() parentId: _id, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(ExpenseReport, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      async checkOldObject(oldObject: ExpenseReportDoc) {
        if (
          !oldObject.historic &&
          (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
          checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
        ) {
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      }
    })
  }

  @Post()
  public async postAny(
    @Body() requestBody: { project?: IdDocument; _id: _id; name?: string; advances?: IdDocument[]; category?: IdDocument },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { editor: request.user._id })

    return await this.setter(ExpenseReport, {
      requestBody: extendedBody,
      allowNew: false,
      checkOldObject: async (oldObject: ExpenseReportDoc) =>
        !oldObject.historic &&
        (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
        checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
    })
  }

  @Post('inWork')
  public async postBackInWork(
    @Body()
    requestBody: {
      project?: IdDocument
      _id?: _id
      name?: string
      advances?: IdDocument[]
      category?: IdDocument
      owner?: IdDocument
      comment?: string
    },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: ExpenseReportState.IN_WORK, editor: request.user._id })
    if (!extendedBody._id) {
      ;(extendedBody as any).log = { [ExpenseReportState.IN_WORK]: { date: new Date(), editor: request.user._id } }
      if (!extendedBody.name) {
        const date = new Date()
        extendedBody.name = `${i18n.t('labels.expenses', { lng: request.user.settings.language })} ${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
    }
    return await this.setter(ExpenseReport, {
      requestBody: extendedBody,
      cb: (e: IExpenseReport) => sendNotification(e, extendedBody._id ? 'BACK_TO_IN_WORK' : undefined),
      allowNew: true,
      async checkOldObject(oldObject: ExpenseReportDoc) {
        if (oldObject.state === ExpenseReportState.IN_REVIEW && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('refunded')
  public async postRefunded(
    @Body() requestBody: { _id: _id; comment?: string; bookingRemark?: string | null },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: ExpenseReportState.REVIEW_COMPLETED, editor: request.user._id })

    const cb = async (expenseReport: IExpenseReport) => {
      sendNotification(expenseReport)
      sendViaMail(expenseReport)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
        await writeToDisk(await writeToDiskFilePath(expenseReport), await reportPrinter.print(expenseReport, i18n.language as Locale))
      }
    }

    return await this.setter(ExpenseReport, {
      requestBody: extendedBody,
      cb,
      allowNew: false,
      async checkOldObject(oldObject: ExpenseReportDoc) {
        if (oldObject.state === ExpenseReportState.IN_REVIEW && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('underExamination')
  public async postAnyUnderExamination(
    @Body() requestBody: { _id: _id; comment?: string },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: ExpenseReportState.IN_REVIEW, editor: request.user._id })

    return await this.setter(ExpenseReport, {
      requestBody: extendedBody,
      cb: sendNotification,
      allowNew: false,
      async checkOldObject(oldObject: ExpenseReportDoc) {
        if (oldObject.state === ExpenseReportState.IN_WORK && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReport(@Query() _id: _id, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<IExpenseReport> = { _id, historic: false, state: { $gte: State.BOOKABLE } }
    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    const expenseReport = await ExpenseReport.findOne(filter).lean()
    if (!expenseReport) {
      throw new NotFoundError(`No expense report with id: '${_id}' found or not allowed`)
    }
    const report = await reportPrinter.print(expenseReport, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(expenseReport.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }
}

@Tags('Expense Report')
@Route('refunded/expenseReport')
@Security('cookieAuth', ['refunded/expenseReport'])
@Security('httpBearer', ['refunded/expenseReport'])
export class ExpenseReportRefundedController extends Controller {
  @Get()
  public async getRefunded(@Queries() query: GetterQuery<IExpenseReport>, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<IExpenseReport> = { historic: false, state: { $gte: State.BOOKABLE } }
    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    return await this.getter(ExpenseReport, {
      query,
      filter,
      projection: { history: 0, historic: 0, expenses: 0 },
      allowedAdditionalFields: ['expenses'],
      sort: { updatedAt: -1 }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getRefundedReport(@Query() _id: _id, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<IExpenseReport> = { _id, historic: false, state: { $gte: State.BOOKABLE } }
    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    const expenseReport = await ExpenseReport.findOne(filter).lean()
    if (!expenseReport) {
      throw new NotFoundError(`No expense report with id: '${_id}' found or not allowed`)
    }
    const report = await reportPrinter.print(expenseReport, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(expenseReport.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }
}
