import { Readable } from 'node:stream'
import {
  IdDocument,
  Travel as ITravel,
  User as IUser,
  idDocumentToId,
  Locale,
  Stage,
  State,
  TravelExpense,
  TravelState,
  UserWithName
} from 'abrechnung-common/types.js'
import { Condition, mongo, Types } from 'mongoose'
import { Body, Consumes, Delete, Get, Middlewares, Post, Produces, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import ENV from '../env.js'
import { reportPrinter } from '../factory.js'
import { checkIfUserIsProjectSupervisor, documentFileHandler, fileHandler, writeToDisk } from '../helper.js'
import i18n from '../i18n.js'
import Travel, { TravelDoc } from '../models/travel.js'
import User from '../models/user.js'
import { sendA1Notification, sendNotification } from '../notifications/notification.js'
import { sendViaMail, writeToDiskFilePath } from '../pdf/helper.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { AuthorizationError, NotFoundError } from './error.js'
import { AuthenticatedExpressRequest, TravelApplication, TravelPost } from './types.js'

@Tags('Travel')
@Route('travel')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class TravelController extends Controller {
  @Get()
  public async getOwn(@Queries() query: GetterQuery<ITravel>, @Request() request: AuthenticatedExpressRequest) {
    return await this.getter(Travel, {
      query,
      filter: { owner: request.user._id, historic: false },
      projection: { history: 0, historic: 0, expenses: 0, stages: 0, days: 0, bookingRemark: 0 },
      allowedAdditionalFields: ['expenses', 'stages', 'days'],
      sort: { startDate: -1 }
    })
  }
  @Delete()
  public async deleteOwn(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleter(Travel, {
      _id: _id,
      checkOldObject: async (oldObject: TravelDoc) => !oldObject.historic && oldObject.owner._id.equals(request.user._id)
    })
  }

  @Post()
  public async postLumpSums(
    @Body() requestBody: SetterBody<{ days: TravelPost['days']; lastPlaceOfWork: TravelPost['lastPlaceOfWork']; _id: TravelPost['_id'] }>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { editor: request.user._id })
    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic && oldObject.owner._id.equals(request.user._id) && oldObject.state === State.EDITABLE_BY_OWNER
    })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postExpenseToOwn(
    @Query('parentId') parentId: string,
    @Body() requestBody: SetterBody<TravelExpense<Types.ObjectId, mongo.Binary>>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    // multipart/form-data does not send null values
    // so we need to set it to null if the value is an empty string
    if (requestBody.project?.toString() === '') {
      requestBody.project = null
    }
    return await this.setterForArrayElement(Travel, {
      requestBody: requestBody as TravelExpense,
      parentId,
      arrayElementKey: 'expenses',
      allowNew: true,
      async checkOldObject(oldObject: TravelDoc) {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          await documentFileHandler(['cost', 'receipts'])(request)
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      },
      sortFn: (a: TravelExpense, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Post('stage')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postStageToOwn(
    @Query('parentId') parentId: string,
    @Body() requestBody: SetterBody<Stage<Types.ObjectId, mongo.Binary>>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    // multipart/form-data does not send null values
    // so we need to set it to null if the value is an empty string
    if (requestBody.project?.toString() === '') {
      requestBody.project = null
    }
    return await this.setterForArrayElement(Travel, {
      requestBody: requestBody as Stage,
      parentId,
      arrayElementKey: 'stages',
      allowNew: true,
      async checkOldObject(oldObject: TravelDoc) {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          await documentFileHandler(['cost', 'receipts'])(request)
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      },
      sortFn: (a: Stage, b) => new Date(a.departure).valueOf() - new Date(b.departure).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpeneseFromOwn(@Query() _id: string, @Query() parentId: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      checkOldObject: async (oldObject: TravelDoc) => {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      }
    })
  }

  @Delete('stage')
  public async deleteStageFromOwn(@Query() _id: string, @Query() parentId: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'stages',
      checkOldObject: async (oldObject: TravelDoc) => {
        if (!oldObject.historic && oldObject.state === State.EDITABLE_BY_OWNER && request.user._id.equals(oldObject.owner._id)) {
          // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
          oldObject.editor = request.user._id as any
          return true
        }
        return false
      }
    })
  }

  @Post('appliedFor')
  public async postOwnInWork(@Body() requestBody: TravelApplication, @Request() request: AuthenticatedExpressRequest) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.APPLIED_FOR, editor: request.user._id })

    if (!extendedBody._id) {
      if (!request.user.access['appliedFor:travel']) {
        throw new AuthorizationError()
      }
      Object.assign(extendedBody, { owner: request.user._id })
      if (!extendedBody.name && extendedBody.startDate) {
        const date = new Date(extendedBody.startDate)
        extendedBody.name = `${extendedBody.destinationPlace?.place} ${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
    }
    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendNotification,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic &&
        oldObject.state <= TravelState.APPROVED &&
        request.user._id.equals(oldObject.owner._id) &&
        request.user.access['appliedFor:travel'],
      allowNew: true
    })
  }

  @Post('approved')
  public async postOwnApproved(@Body() requestBody: TravelApplication, @Request() request: AuthenticatedExpressRequest) {
    let extendedBody: SetterBody<ITravel<Types.ObjectId, mongo.Binary>> = requestBody
    let cb: ((travel: ITravel<Types.ObjectId>) => unknown) | undefined
    if (!extendedBody._id) {
      if (!request.user.access['approved:travel']) {
        throw new AuthorizationError()
      }
      if (!extendedBody.name && extendedBody.startDate) {
        const date = new Date(extendedBody.startDate)
        extendedBody.name = `${extendedBody.destinationPlace?.place} ${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
      cb = (travel: ITravel) => {
        if (travel.isCrossBorder && travel.destinationPlace.country.needsA1Certificate) {
          sendA1Notification(travel)
        }
      }
      Object.assign(extendedBody, { state: TravelState.APPROVED, editor: request.user._id, owner: request.user._id })
    } else {
      extendedBody = Object.assign({ _id: extendedBody._id }, { state: TravelState.APPROVED, editor: request.user._id })
    }
    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: true,
      cb,
      async checkOldObject(oldObject: TravelDoc) {
        if (
          oldObject.owner._id.equals(request.user._id) &&
          oldObject.state === TravelState.IN_REVIEW &&
          oldObject.editor._id.equals(request.user._id)
        ) {
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
    const extendedBody = Object.assign(requestBody, { state: TravelState.IN_REVIEW, editor: request.user._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendNotification,
      allowNew: false,
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.owner._id.equals(request.user._id) && oldObject.state === TravelState.APPROVED) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getOwnReport(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    const travel = await Travel.findOne({ _id: _id, owner: request.user._id, historic: false, state: { $gte: State.BOOKABLE } }).lean()
    if (!travel) {
      throw new NotFoundError(`No travel with id: '${_id}' found or not allowed`)
    }
    const report = await reportPrinter.print(travel, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(travel.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }

  @Get('examiner')
  public async getExaminer() {
    return await this.getter<UserWithName, IUser<Types.ObjectId, mongo.Binary>>(User, {
      query: { limit: 5 },
      filter: { 'access.examine/travel': true },
      projection: { name: 1, email: 1 }
    })
  }
}

@Tags('Travel')
@Route('approve/travel')
@Security('cookieAuth', ['approve/travel'])
@Security('httpBearer', ['approve/travel'])
export class TravelApproveController extends Controller {
  @Get()
  public async getToApprove(@Queries() query: GetterQuery<ITravel>, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<ITravel> = { $and: [{ historic: false, state: { $gte: State.APPLIED_FOR, $lt: State.IN_REVIEW } }] }
    if (request.user.projects.supervised.length > 0) {
      filter.$and.push({ project: { $in: request.user.projects.supervised } })
    }
    return await this.getter(Travel, {
      query,
      filter,
      projection: { history: 0, historic: 0, expenses: 0, stages: 0, days: 0 },
      sort: { updatedAt: -1 }
    })
  }

  @Post('approved')
  public async postAnyBackApproved(
    @Body() requestBody: ((TravelApplication & { owner: IdDocument }) | { _id: string }) & { comment?: string },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.APPROVED, editor: request.user._id })
    if (!extendedBody._id) {
      const travelApplication = extendedBody as TravelApplication
      if (!travelApplication.name && travelApplication.startDate) {
        const date = new Date(travelApplication.startDate as string)
        travelApplication.name = `${travelApplication.destinationPlace?.place} ${i18n.t(`monthsShort.${date.getUTCMonth()}`, { lng: request.user.settings.language })} ${date.getUTCFullYear()}`
      }
    }
    const cb = async (travel: ITravel) => {
      sendNotification(travel)
      if (travel.isCrossBorder && travel.destinationPlace.country.needsA1Certificate) {
        sendA1Notification(travel)
      }
    }

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb,
      allowNew: true,
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.state === TravelState.APPLIED_FOR && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('rejected')
  public async postAnyRejected(@Body() requestBody: { _id: string; comment?: string }, @Request() request: AuthenticatedExpressRequest) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.REJECTED, editor: request.user._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendNotification,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) =>
        oldObject.state === TravelState.APPLIED_FOR && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
    })
  }
}

@Tags('Travel')
@Route('examine/travel')
@Security('cookieAuth', ['examine/travel'])
@Security('httpBearer', ['examine/travel'])
export class TravelExamineController extends Controller {
  @Get()
  public async getToExamine(@Queries() query: GetterQuery<ITravel>, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<ITravel> = { $and: [{ historic: false, state: { $gte: State.EDITABLE_BY_OWNER } }] }
    if (request.user.projects.supervised.length > 0) {
      filter.$and.push({ project: { $in: request.user.projects.supervised } })
    }
    return await this.getter(Travel, {
      query,
      filter,
      projection: { history: 0, historic: 0, expenses: 0, stages: 0, days: 0 },
      allowedAdditionalFields: ['expenses', 'stages', 'days'],
      sort: { updatedAt: -1 }
    })
  }

  @Post()
  public async postAny(@Body() requestBody: SetterBody<TravelPost>, @Request() request: AuthenticatedExpressRequest) {
    const extendedBody = Object.assign(requestBody, { editor: request.user._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic &&
        (oldObject.state === State.EDITABLE_BY_OWNER || oldObject.state === State.IN_REVIEW) &&
        checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
    })
  }

  @Delete()
  public async deleteAny(@Query() _id: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleter(Travel, {
      _id: _id,
      async checkOldObject(oldObject: TravelDoc) {
        return checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
      }
    })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postExpenseToAny(
    @Query('parentId') parentId: string,
    @Body() requestBody: SetterBody<TravelExpense<Types.ObjectId, mongo.Binary>>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    // multipart/form-data does not send null values
    // so we need to set it to null if the value is an empty string
    if (requestBody.project?.toString() === '') {
      requestBody.project = null
    }
    return await this.setterForArrayElement(Travel, {
      requestBody: requestBody as TravelExpense,
      parentId,
      arrayElementKey: 'expenses',
      allowNew: true,
      async checkOldObject(oldObject: TravelDoc) {
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
      sortFn: (a: TravelExpense, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Post('stage')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postStageToAny(
    @Query('parentId') parentId: string,
    @Body() requestBody: SetterBody<Stage<Types.ObjectId, mongo.Binary>>,
    @Request() request: AuthenticatedExpressRequest
  ) {
    // multipart/form-data does not send null values
    // so we need to set it to null if the value is an empty string
    if (requestBody.project?.toString() === '') {
      requestBody.project = null
    }
    return await this.setterForArrayElement(Travel, {
      requestBody: requestBody as Stage,
      parentId,
      arrayElementKey: 'stages',
      allowNew: true,
      async checkOldObject(oldObject: TravelDoc) {
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
      sortFn: (a: Stage, b) => new Date(a.departure).valueOf() - new Date(b.departure).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpeneseFromAny(@Query() _id: string, @Query() parentId: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      async checkOldObject(oldObject: TravelDoc) {
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

  @Delete('stage')
  public async deleteStageFromAny(@Query() _id: string, @Query() parentId: string, @Request() request: AuthenticatedExpressRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'stages',
      async checkOldObject(oldObject: TravelDoc) {
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

  @Post('reviewCompleted')
  public async postReviewCompleted(
    @Body() requestBody: { _id: string; comment?: string; bookingRemark?: string | null },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.REVIEW_COMPLETED, editor: request.user._id })

    const cb = async (travel: ITravel<Types.ObjectId>) => {
      sendNotification(travel)
      sendViaMail(travel)
      if (ENV.BACKEND_SAVE_REPORTS_ON_DISK) {
        await writeToDisk(await writeToDiskFilePath(travel), await reportPrinter.print(travel, i18n.language as Locale))
      }
    }

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb,
      allowNew: false,
      async checkOldObject(oldObject: TravelDoc) {
        if (
          !oldObject.historic &&
          oldObject.state === TravelState.IN_REVIEW &&
          checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)
        ) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('approved')
  public async postAnyApproved(@Body() requestBody: { _id: string; comment?: string }, @Request() request: AuthenticatedExpressRequest) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.APPROVED, editor: request.user._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      cb: (e: ITravel) => sendNotification(e, 'BACK_TO_APPROVED'),
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.state === TravelState.IN_REVIEW && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
          await oldObject.saveToHistory()
          return true
        }
        return false
      }
    })
  }

  @Post('underExamination')
  public async postAnyUnderExamination(
    @Body() requestBody: { _id: string; comment?: string },
    @Request() request: AuthenticatedExpressRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: TravelState.IN_REVIEW, editor: request.user._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendNotification,
      allowNew: false,
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.state === TravelState.APPROVED && checkIfUserIsProjectSupervisor(request.user, oldObject.project._id)) {
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
    const filter: Condition<ITravel> = { _id, historic: false, state: { $gte: State.BOOKABLE } }
    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    const travel = await Travel.findOne(filter).lean()
    if (!travel) {
      throw new NotFoundError(`No travel with id: '${_id}' found or not allowed`)
    }
    const report = await reportPrinter.print(travel, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(travel.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }
}

@Tags('Travel')
@Route('book/travel')
@Security('cookieAuth', ['book/travel'])
@Security('httpBearer', ['book/travel'])
export class TravelBookableController extends Controller {
  @Get()
  public async getBookable(@Queries() query: GetterQuery<ITravel>, @Request() request: AuthenticatedExpressRequest) {
    const filter: Condition<ITravel> = { historic: false, state: { $gte: State.BOOKABLE } }
    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    return await this.getter(Travel, {
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
    const filter: Condition<ITravel> = { _id, historic: false, state: { $gte: State.BOOKABLE } }
    if (request.user.projects.supervised.length > 0) {
      filter.project = { $in: request.user.projects.supervised }
    }
    const travel = await Travel.findOne(filter).lean()
    if (!travel) {
      throw new NotFoundError(`No travel with id: '${_id}' found or not allowed`)
    }
    const report = await reportPrinter.print(travel, request.user.settings.language)
    this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(travel.name)}.pdf`)
    this.setHeader('Content-Type', 'application/pdf')
    this.setHeader('Content-Length', report.length)
    return Readable.from([report])
  }

  @Post('booked')
  public async postBooked(@Body() requestBody: IdDocument<string>[], @Request() request: AuthenticatedExpressRequest) {
    const results = await Promise.allSettled(
      requestBody.map((id) => {
        const doc = { _id: idDocumentToId(id), state: State.BOOKED, editor: request.user._id }
        return this.setter(Travel, {
          requestBody: doc,
          allowNew: false,
          async checkOldObject(oldObject: TravelDoc) {
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
