import { Readable } from 'node:stream'
import { Condition } from 'mongoose'
import { Body, Delete, Get, Post, Produces, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { Advance as IAdvance, Locale, _id } from '../../common/types.js'
import { reportPrinter } from '../factory.js'
import { checkIfUserIsProjectSupervisor, writeToDisk } from '../helper.js'
import i18n from '../i18n.js'
import Advance, { AdvanceDoc } from '../models/advance.js'
import User from '../models/user.js'
import { sendNotification } from '../notifications/notification.js'
import { sendViaMail, writeToDiskFilePath } from '../pdf/helper.js'
import { Controller, GetterQuery, checkOwner } from './controller.js'
import { AuthorizationError, NotFoundError } from './error.js'
import { AuthenticatedExpressRequest, IdDocument, MoneyPost } from './types.js'

interface AdvanceApplication {
  project?: IdDocument
  _id?: _id
  name?: string
  budget: MoneyPost | undefined
  reason: string
  comment?: string
}

@Tags('Expense Report')
@Route('advance')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class AdvanceController extends Controller {
  @Get()
  public async getOwn(@Queries() query: GetterQuery<IAdvance>, @Request() request: AuthenticatedExpressRequest) {
    return await this.getter(Advance, {
      query,
      filter: { owner: request.user._id, historic: false },
      projection: { history: 0, historic: 0 },
      sort: { createdAt: -1 }
    })
  }
  @Delete()
  public async deleteOwn(@Query() _id: _id, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleter(Advance, {
      _id: _id,
      checkOldObject: async (oldObject: AdvanceDoc) => request.user._id.equals(oldObject.owner._id) && oldObject.state === 'appliedFor'
    })
  }

  @Post('appliedFor')
  public async postOwnInWork(@Body() requestBody: AdvanceApplication, @Request() request: AuthenticatedExpressRequest) {
    const extendedBody = Object.assign(requestBody, {
      state: 'appliedFor',
      owner: request.user._id,
      editor: request.user._id
    })

    if (!extendedBody._id) {
      if (!request.user.access['appliedFor:advance']) {
        throw new AuthorizationError()
      }
      if (!extendedBody.name) {
        const date = new Date()
        extendedBody.name = `${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
    }
    return await this.setter(Advance, {
      requestBody: extendedBody,
      cb: sendNotification,
      checkOldObject: async (oldObject: AdvanceDoc) =>
        !oldObject.historic &&
        (oldObject.state === 'appliedFor' || oldObject.state === 'rejected') &&
        request.user._id.equals(oldObject.owner._id) &&
        request.user.access['appliedFor:advance'],
      allowNew: true
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReportForOwn(@Query() _id: _id, @Request() request: AuthenticatedExpressRequest) {
    const advance = await Advance.findOne({
      _id: _id,
      owner: request.user._id,
      historic: false,
      state: { $in: ['completed', 'approved'] }
    }).lean()
    if (!advance) {
      throw new NotFoundError(`No advance with id: '${_id}' found or not allowed`)
    }
    const report = await reportPrinter.print(advance, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(advance.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }
}

@Tags('Advance')
@Route('examine/advance')
@Security('cookieAuth', ['user', 'approve/travel'])
@Security('httpBearer', ['user', 'approve/travel'])
@Security('cookieAuth', ['user', 'examine/travel'])
@Security('httpBearer', ['user', 'examine/travel'])
@Security('cookieAuth', ['user', 'examine/expenseReport'])
@Security('httpBearer', ['user', 'examine/expenseReport'])
@Security('cookieAuth', ['user', 'examine/healthCareCost'])
@Security('httpBearer', ['user', 'examine/healthCareCost'])
export class AdvanceExamineController extends Controller {
  @Get()
  public async getForExamineReport(@Queries() query: GetterQuery<IAdvance>, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<IAdvance> = {
      $and: [{ historic: false }, { state: 'approved' }]
    }
    if (request.user.projects.supervised.length > 0) {
      filter.$and.push({ project: { $in: request.user.projects.supervised } })
    }
    return await this.getter(Advance, {
      query,
      filter,
      projection: { history: 0, historic: 0 },
      sort: { updatedAt: -1 }
    })
  }
}

@Tags('Advance')
@Route('approve/advance')
@Security('cookieAuth', ['approve/advance'])
@Security('httpBearer', ['approve/advance'])
export class AdvanceApproveController extends Controller {
  @Get()
  public async getToApprove(@Queries() query: GetterQuery<IAdvance>, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<IAdvance> = {
      $and: [{ historic: false }, { $or: [{ state: 'appliedFor' }, { state: 'approved' }, { state: 'completed' }] }]
    }
    if (request.user.projects.supervised.length > 0) {
      filter.$and.push({ project: { $in: request.user.projects.supervised } })
    }
    return await this.getter(Advance, {
      query,
      filter,
      projection: { history: 0, historic: 0 },
      sort: { updatedAt: -1 }
    })
  }

  @Post('approved')
  public async postAnyBackApproved(
    @Body() requestBody: (AdvanceApplication & { owner: IdDocument }) | { _id: _id; comment?: string },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: 'approved', editor: request.user._id })
    if (!extendedBody._id) {
      if (!(extendedBody as AdvanceApplication).name) {
        const date = new Date()
        ;(extendedBody as AdvanceApplication).name =
          `${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
    }
    const cb = async (advance: IAdvance) => {
      sendNotification(advance)
      sendViaMail(advance)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
        await writeToDisk(await writeToDiskFilePath(advance), await reportPrinter.print(advance, i18n.language as Locale))
      }
    }

    return await this.setter(Advance, {
      requestBody: extendedBody,
      cb,
      allowNew: true,
      async checkOldObject(oldObject: AdvanceDoc) {
        if (oldObject.state === 'appliedFor' && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('rejected')
  public async postAnyRejected(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: AuthenticatedExpressRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'rejected', editor: request.user._id })

    return await this.setter(Advance, {
      requestBody: extendedBody,
      cb: sendNotification,
      allowNew: false,
      checkOldObject: async (oldObject: AdvanceDoc) =>
        oldObject.state === 'appliedFor' && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReportForAny(@Query() _id: _id, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<IAdvance> = { _id, historic: false, state: { $in: ['completed', 'approved'] } }
    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    const advance = await Advance.findOne(filter).lean()
    if (!advance) {
      throw new NotFoundError(`No advance with id: '${_id}' found or not allowed`)
    }
    const report = await reportPrinter.print(advance, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(advance.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }
}
