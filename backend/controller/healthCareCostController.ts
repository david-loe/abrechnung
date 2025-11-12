import { Readable } from 'node:stream'
import {
  Expense,
  HealthCareCostState,
  IdDocument,
  HealthCareCost as IHealthCareCost,
  Organisation as IOrganisation,
  User as IUser,
  idDocumentToId,
  Locale,
  State,
  UserWithName
} from 'abrechnung-common/types.js'
import { Condition, mongo, Types } from 'mongoose'
import { Body, Consumes, Delete, Get, Middlewares, Post, Produces, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { getSettings } from '../db.js'
import ENV from '../env.js'
import { reportPrinter } from '../factory.js'
import { checkIfUserIsProjectSupervisor, documentFileHandler, fileHandler } from '../helper.js'
import i18n from '../i18n.js'
import HealthCareCost, { HealthCareCostDoc } from '../models/healthCareCost.js'
import Organisation from '../models/organisation.js'
import User from '../models/user.js'
import { sendNotification } from '../notifications/notification.js'
import { sendViaMail, writeToDiskFilePath } from '../pdf/helper.js'
import { runWebhooks } from '../webhooks/execute.js'
import { writeReportToDisk } from '../workers/saveReportOnDisk.js'
import { Controller, checkOwner, GetterQuery, SetterBody } from './controller.js'
import { AuthorizationError, NotFoundError } from './error.js'
import { AuthenticatedExpressRequest } from './types.js'

@Tags('Health Care Cost')
@Route('healthCareCost')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class HealthCareCostController extends Controller {
  @Get()
  public async getOwn(@Queries() query: GetterQuery<IHealthCareCost>, @Request() request: AuthenticatedExpressRequest) {
    return await this.getter(HealthCareCost, {
      query,
      filter: { owner: request.user._id, historic: false },
      projection: { history: 0, historic: 0, expenses: 0, bookingRemark: 0 },
      allowedAdditionalFields: ['expenses'],
      sort: { createdAt: -1 }
    })
  }

  @Delete()
  public async deleteOwn(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    const notAfterReview = (await getSettings()).preventOwnersFromDeletingReportsAfterReviewCompleted
    return await this.deleter(HealthCareCost, {
      _id: _id,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        return !oldObject.historic && (await checkOwner(request.user)(oldObject)) && (!notAfterReview || oldObject.state < State.BOOKABLE)
      }
    })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postExpenseToOwn(
    @Query('parentId') parentId: string,
    @Body() requestBody: SetterBody<Expense<Types.ObjectId, mongo.Binary>>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    // multipart/form-data does not send null values
    // so we need to set it to null if the value is an empty string
    if (requestBody.project?.toString() === '') {
      requestBody.project = null
    }
    return await this.setterForArrayElement(HealthCareCost, {
      requestBody: requestBody as Expense,
      parentId,
      arrayElementKey: 'expenses',
      allowNew: true,
      async checkOldObject(oldObject) {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          await documentFileHandler(['cost', 'receipts'])(request)
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      },
      sortFn: (a: Expense, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpeneseFromOwn(@Query() _id: string, @Query() parentId: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(HealthCareCost, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      async checkOldObject(oldObject) {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      }
    })
  }

  @Post('inWork')
  public async postOwnInWork(
    @Body() requestBody: {
      project?: IdDocument<Types.ObjectId>
      insurance?: IdDocument<Types.ObjectId>
      patientName?: string
      _id?: string
      name?: string
      advances?: IdDocument<Types.ObjectId>[]
    },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: HealthCareCostState.IN_WORK, editor: request.user._id })

    if (!extendedBody._id) {
      if (!request.user.access['inWork:healthCareCost']) {
        throw new AuthorizationError()
      }
      Object.assign(extendedBody, { owner: request.user._id })
      if (!extendedBody.name) {
        const date = new Date()
        extendedBody.name = `${requestBody.patientName} ${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
    }
    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb: runWebhooks,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        if (oldObject.owner._id.equals(request.user._id)) {
          if (oldObject.state === HealthCareCostState.IN_WORK && request.user.access['inWork:healthCareCost']) {
            return true
          }
          if (oldObject.state === HealthCareCostState.IN_REVIEW && oldObject.editor._id.equals(request.user._id)) {
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
    @Body() requestBody: { _id: string; comment?: string },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: HealthCareCostState.IN_REVIEW, editor: request.user._id })

    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb: async (h: IHealthCareCost<Types.ObjectId>) => {
        await runWebhooks(h)
        await sendNotification(h)
      },
      allowNew: false,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        if (oldObject.owner._id.equals(request.user._id) && oldObject.state === HealthCareCostState.IN_WORK) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReportFromOwn(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    const healthCareCost = await HealthCareCost.findOne({
      $and: [{ _id, owner: request.user._id, historic: false, state: { $gte: State.BOOKABLE } }]
    }).lean()
    if (!healthCareCost) {
      throw new NotFoundError(`No health care cost with id: '${_id}' found or not allowed`)
    }
    const report = await reportPrinter.print(healthCareCost, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(healthCareCost.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }

  @Get('examiner')
  public async getExaminer() {
    return await this.getter<UserWithName, IUser<Types.ObjectId, mongo.Binary>>(User, {
      query: { limit: 5 },
      filter: { 'access.examine/healthCareCost': true },
      projection: { name: 1, email: 1 }
    })
  }
}

@Tags('Health Care Cost')
@Route('examine/healthCareCost')
@Security('cookieAuth', ['examine/healthCareCost'])
@Security('httpBearer', ['examine/healthCareCost'])
export class HealthCareCostExamineController extends Controller {
  @Get()
  public async getToExamine(@Queries() query: GetterQuery<IHealthCareCost>, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<IHealthCareCost> = { historic: false }
    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    return await this.getter(HealthCareCost, {
      query,
      filter,
      projection: { history: 0, historic: 0, expenses: 0 },
      allowedAdditionalFields: ['expenses'],
      sort: { updatedAt: -1 }
    })
  }

  @Delete()
  public async deleteAny(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleter(HealthCareCost, {
      _id: _id,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        return checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
      }
    })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postExpenseToAny(
    @Query('parentId') parentId: string,
    @Body() requestBody: SetterBody<Expense<Types.ObjectId, mongo.Binary>>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    // multipart/form-data does not send null values
    // so we need to set it to null if the value is an empty string
    if (requestBody.project?.toString() === '') {
      requestBody.project = null
    }
    return await this.setterForArrayElement(HealthCareCost, {
      requestBody: requestBody as Expense,
      parentId,
      arrayElementKey: 'expenses',
      allowNew: true,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        if (
          !oldObject.historic &&
          (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
          checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
        ) {
          await documentFileHandler(['cost', 'receipts'], { owner: oldObject.owner._id })(request)
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      },
      sortFn: (a: Expense, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpenseFromAny(@Query() _id: string, @Query() parentId: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(HealthCareCost, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      async checkOldObject(oldObject: HealthCareCostDoc) {
        if (
          !oldObject.historic &&
          (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
          checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
        ) {
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      }
    })
  }
  @Post()
  public async postAny(
    @Body() requestBody: {
      project?: IdDocument<Types.ObjectId>
      insurance?: IdDocument<Types.ObjectId>
      patientName?: string
      _id: string
      name?: string
      advances?: IdDocument<Types.ObjectId>[]
    },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { editor: request.user._id })

    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      allowNew: false,
      checkOldObject: async (oldObject: HealthCareCostDoc) =>
        !oldObject.historic &&
        (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
        checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
    })
  }

  @Post('inWork')
  public async postBackInWork(
    @Body()
    requestBody: {
      project?: IdDocument<Types.ObjectId>
      insurance?: IdDocument<Types.ObjectId>
      patientName?: string
      _id?: string
      name?: string
      owner?: IdDocument<Types.ObjectId>
      comment?: string
      advances?: IdDocument<Types.ObjectId>[]
    },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: HealthCareCostState.IN_WORK, editor: request.user._id })
    if (!extendedBody._id) {
      if (!extendedBody.name) {
        const date = new Date()
        extendedBody.name = `${requestBody.patientName} ${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
    }
    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb: async (h: IHealthCareCost<Types.ObjectId>) => {
        await runWebhooks(h)
        await sendNotification(h, extendedBody._id ? 'BACK_TO_IN_WORK' : undefined)
      },
      allowNew: true,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        if (oldObject.state === HealthCareCostState.IN_REVIEW && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('reviewCompleted')
  public async postReviewCompleted(
    @Body() requestBody: { _id: string; comment?: string; bookingRemark?: string | null },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: HealthCareCostState.REVIEW_COMPLETED, editor: request.user._id })

    const cb = async (h: IHealthCareCost<Types.ObjectId>) => {
      await runWebhooks(h)
      await sendNotification(h)
      await sendViaMail(h)
      if (ENV.BACKEND_SAVE_REPORTS_ON_DISK) {
        await writeReportToDisk(await writeToDiskFilePath(h), h)
      }
    }

    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb,
      allowNew: false,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        if (oldObject.state === HealthCareCostState.IN_REVIEW && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('underExamination')
  public async postOwnUnderExamination(
    @Body() requestBody: { _id: string; comment?: string },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: HealthCareCostState.IN_REVIEW, editor: request.user._id })

    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb: async (h: IHealthCareCost<Types.ObjectId>) => {
        await runWebhooks(h)
        await sendNotification(h)
      },
      allowNew: false,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        if (oldObject.state === HealthCareCostState.IN_WORK && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReport(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<IHealthCareCost> = { _id, historic: false, state: { $gte: State.BOOKABLE } }
    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    const healthCareCost = await HealthCareCost.findOne(filter).lean()
    if (!healthCareCost) {
      throw new NotFoundError(`No health care cost with id: '${_id}' found or not allowed`)
    }
    const report = await reportPrinter.print(healthCareCost, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(healthCareCost.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }

  @Get('organisation')
  public async getOrganisation(@Queries() query: GetterQuery<IOrganisation>) {
    return await this.getter(Organisation, { query })
  }
}

@Tags('Health Care Cost')
@Route('book/healthCareCost')
@Security('cookieAuth', ['book/healthCareCost'])
@Security('httpBearer', ['book/healthCareCost'])
export class HealthCareCostBookableController extends Controller {
  @Get()
  public async getBookable(@Queries() query: GetterQuery<IHealthCareCost>, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<IHealthCareCost> = { historic: false, state: { $gte: State.BOOKABLE } }

    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    return await this.getter(HealthCareCost, {
      query,
      filter,
      projection: { history: 0, historic: 0, expenses: 0 },
      allowedAdditionalFields: ['expenses'],
      sort: { updatedAt: -1 }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getBookableReport(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<IHealthCareCost> = { _id, historic: false, state: { $gte: State.BOOKABLE } }

    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    const healthCareCost = await HealthCareCost.findOne(filter).lean()
    if (!healthCareCost) {
      throw new NotFoundError(`No health care cost with id: '${_id}' found or not allowed`)
    }
    const report = await reportPrinter.print(healthCareCost, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(healthCareCost.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }

  @Post('booked')
  public async postBooked(@Body() requestBody: IdDocument<string>[], @Request() request: AuthenticatedExpressRequest) {
    const results = await Promise.allSettled(
      requestBody.map((id) => {
        const doc = { _id: idDocumentToId(id), state: State.BOOKED, editor: request.user._id }
        return this.setter(HealthCareCost, {
          requestBody: doc,
          allowNew: false,
          async checkOldObject(oldObject: HealthCareCostDoc) {
            if (oldObject.state === State.BOOKABLE && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
              await oldObject.saveToHistory()
              return true
            }
            return false
          }
        })
      })
    )
    const reducedResults = results.map((r) => ({ status: r.status, reason: (r as PromiseRejectedResult).reason }))
    const count = reducedResults.length
    const fulfilledCount = reducedResults.filter((entry) => entry.status === 'fulfilled').length
    if (fulfilledCount === 0 && count > 0) {
      throw new Error(reducedResults[0].reason)
    }
    return { result: reducedResults, message: `${fulfilledCount}/${count}` }
  }
}
