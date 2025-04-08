import { Request as ExRequest } from 'express'
import { Condition } from 'mongoose'
import { Readable } from 'stream'
import { Body, Delete, Get, Middlewares, Post, Produces, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { Travel as ITravel, Locale, Stage, TravelExpense, TravelState, _id } from '../../common/types.js'
import { reportPrinter } from '../factory.js'
import { checkIfUserIsProjectSupervisor, documentFileHandler, fileHandler, writeToDisk } from '../helper.js'
import i18n from '../i18n.js'
import Travel, { TravelDoc } from '../models/travel.js'
import User from '../models/user.js'
import { sendA1Notification, sendNotification } from '../notifications/notification.js'
import { sendViaMail, writeToDiskFilePath } from '../pdf/helper.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { AuthorizationError, NotFoundError } from './error.js'
import { IdDocument, TravelApplication, TravelPost } from './types.js'

@Tags('Travel')
@Route('travel')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class TravelController extends Controller {
  @Get()
  public async getOwn(@Queries() query: GetterQuery<ITravel>, @Request() request: ExRequest) {
    return await this.getter(Travel, {
      query,
      filter: { owner: request.user!._id, historic: false },
      projection: { history: 0, historic: 0, expenses: 0, stages: 0, days: 0 },
      allowedAdditionalFields: ['expenses', 'stages', 'days'],
      sort: { startDate: -1 }
    })
  }
  @Delete()
  public async deleteOwn(@Query() _id: _id, @Request() request: ExRequest) {
    return await this.deleter(Travel, {
      _id: _id,
      checkOldObject: async (oldObject: TravelDoc) => !oldObject.historic && oldObject.owner._id.equals(request.user!._id)
    })
  }

  @Post()
  public async postOwn(@Body() requestBody: SetterBody<TravelPost>, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { editor: request.user?._id })
    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic && oldObject.owner._id.equals(request.user!._id) && oldObject.state !== 'refunded'
    })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  public async postExpenseToOwn(
    @Query('parentId') parentId: _id,
    @Body() requestBody: SetterBody<TravelExpense>,
    @Request() request: ExRequest
  ) {
    return await this.setterForArrayElement(Travel, {
      requestBody,
      parentId,
      arrayElementKey: 'expenses',
      allowNew: true,
      async checkOldObject(oldObject) {
        if (!oldObject.historic && oldObject.state === 'approved' && request.user!._id.equals(oldObject.owner._id)) {
          await documentFileHandler(['cost', 'receipts'])(request)
          return true
        } else {
          return false
        }
      },
      sortFn: (a: TravelExpense, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Post('stage')
  @Middlewares(fileHandler.any())
  public async postStageToOwn(@Query('parentId') parentId: _id, @Body() requestBody: SetterBody<Stage>, @Request() request: ExRequest) {
    return await this.setterForArrayElement(Travel, {
      requestBody,
      parentId,
      arrayElementKey: 'stages',
      allowNew: true,
      async checkOldObject(oldObject) {
        if (!oldObject.historic && oldObject.state === 'approved' && request.user!._id.equals(oldObject.owner._id)) {
          await documentFileHandler(['cost', 'receipts'])(request)
          return true
        } else {
          return false
        }
      },
      sortFn: (a: Stage, b) => new Date(a.departure).valueOf() - new Date(b.departure).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpeneseFromOwn(@Query() _id: _id, @Query() parentId: _id, @Request() request: ExRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic && oldObject.state === 'approved' && request.user!._id.equals(oldObject.owner._id)
    })
  }

  @Delete('stage')
  public async deleteStageFromOwn(@Query() _id: _id, @Query() parentId: _id, @Request() request: ExRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'stages',
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic && oldObject.state === 'approved' && request.user!._id.equals(oldObject.owner._id)
    })
  }

  @Post('appliedFor')
  public async postOwnInWork(@Body() requestBody: TravelApplication, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, {
      state: 'appliedFor' as TravelState,
      owner: request.user?._id,
      editor: request.user?._id,
      lastPlaceOfWork: { country: requestBody.destinationPlace?.country, place: '' }
    })

    if (!extendedBody._id) {
      if (!request.user!.access['appliedFor:travel']) {
        throw new AuthorizationError()
      } else if (!extendedBody.name && extendedBody.startDate) {
        let date = new Date(extendedBody.startDate)
        extendedBody.name =
          extendedBody.destinationPlace?.place +
          ' ' +
          i18n.t('monthsShort.' + date.getUTCMonth(), { lng: request.user!.settings.language }) +
          ' ' +
          date.getUTCFullYear()
      }
    }
    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendNotification,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic &&
        (oldObject.state === 'appliedFor' || oldObject.state === 'rejected' || oldObject.state === 'approved') &&
        request.user!._id.equals(oldObject.owner._id) &&
        request.user!.access['appliedFor:travel'],
      allowNew: true
    })
  }

  @Post('approved')
  public async postOwnApproved(@Body() requestBody: TravelApplication, @Request() request: ExRequest) {
    let extendedBody: SetterBody<ITravel> = requestBody
    let cb = (travel: ITravel) => {}
    if (!extendedBody._id) {
      if (!request.user!.access['approved:travel']) {
        throw new AuthorizationError()
      } else if (!extendedBody.name && extendedBody.startDate) {
        let date = new Date(extendedBody.startDate)
        extendedBody.name =
          extendedBody.destinationPlace?.place +
          ' ' +
          i18n.t('monthsShort.' + date.getUTCMonth(), { lng: request.user!.settings.language }) +
          ' ' +
          date.getUTCFullYear()
      }
      cb = (travel: ITravel) => {
        if (travel.isCrossBorder && travel.destinationPlace.country.needsA1Certificate) {
          sendA1Notification(travel)
        }
      }
      Object.assign(extendedBody, {
        state: 'approved' as TravelState,
        editor: request.user?._id,
        owner: request.user?._id,
        lastPlaceOfWork: { country: requestBody.destinationPlace?.country, place: '' }
      })
    } else {
      extendedBody = Object.assign({ _id: extendedBody._id }, { state: 'approved' as TravelState, editor: request.user?._id })
    }
    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: true,
      cb,
      async checkOldObject(oldObject: TravelDoc) {
        if (
          oldObject.owner._id.equals(request.user!._id) &&
          oldObject.state === 'underExamination' &&
          oldObject.editor._id.equals(request.user!._id)
        ) {
          await oldObject.saveToHistory()
          await oldObject.save()
          return true
        } else {
          return false
        }
      }
    })
  }

  @Post('underExamination')
  public async postOwnUnderExamination(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'underExamination' as TravelState, editor: request.user?._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendNotification,
      allowNew: false,
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.owner._id.equals(request.user!._id) && oldObject.state === 'approved') {
          await oldObject.saveToHistory()
          await oldObject.save()
          return true
        } else {
          return false
        }
      }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getOwnReport(@Query() _id: _id, @Request() request: ExRequest) {
    const travel = await Travel.findOne({
      _id: _id,
      owner: request.user!._id,
      historic: false,
      state: 'refunded'
    }).lean()
    if (travel) {
      const report = await reportPrinter.print(travel, request.user!.settings.language)
      this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(travel.name)}.pdf`)
      this.setHeader('Content-Type', 'application/pdf')
      this.setHeader('Content-Length', report.length)
      return Readable.from([report])
    } else {
      throw new NotFoundError(`No travel with id: '${_id}' found or not allowed`)
    }
  }

  @Get('examiner')
  public async getExaminer() {
    return await this.getter(User, {
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
  public async getToApprove(@Queries() query: GetterQuery<ITravel>, @Request() request: ExRequest) {
    const filter: Condition<ITravel> = { $and: [{ historic: false }, { $or: [{ state: 'appliedFor' }, { state: 'approved' }] }] }
    if (request.user!.projects.supervised.length > 0) {
      filter.$and.push({ project: { $in: request.user!.projects.supervised } })
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
    @Body() requestBody: (TravelApplication & { owner: IdDocument }) | { _id: _id; comment?: string },
    @Request() request: ExRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: 'approved' as TravelState, editor: request.user?._id })
    if (!extendedBody._id) {
      ;(extendedBody as any).lastPlaceOfWork = { country: (extendedBody as TravelApplication).destinationPlace?.country, place: '' }
      if (!(extendedBody as TravelApplication).name && (extendedBody as TravelApplication).startDate) {
        let date = new Date((extendedBody as TravelApplication).startDate!)
        ;(extendedBody as TravelApplication).name =
          (extendedBody as TravelApplication).destinationPlace?.place +
          ' ' +
          i18n.t('monthsShort.' + date.getUTCMonth(), { lng: request.user!.settings.language }) +
          ' ' +
          date.getUTCFullYear()
      }
    }
    const cb = async (travel: ITravel) => {
      sendNotification(travel)
      if (travel.isCrossBorder && travel.destinationPlace.country.needsA1Certificate) {
        sendA1Notification(travel)
      }
      if (travel.advance.amount !== null && travel.advance.amount > 0) {
        sendViaMail(travel)
        if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
          await writeToDisk(await writeToDiskFilePath(travel), await reportPrinter.print(travel, i18n.language as Locale))
        }
      }
    }

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb,
      allowNew: true,
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.state === 'appliedFor' && checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)) {
          await oldObject.saveToHistory()
          await oldObject.save()
          return true
        } else {
          return false
        }
      }
    })
  }

  @Post('rejected')
  public async postAnyRejected(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'rejected' as TravelState, editor: request.user?._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendNotification,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) =>
        oldObject.state === 'appliedFor' && checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
    })
  }
}

@Tags('Travel')
@Route('examine/travel')
@Security('cookieAuth', ['examine/travel'])
@Security('httpBearer', ['examine/travel'])
export class TravelExamineController extends Controller {
  @Get()
  public async getToExamine(@Queries() query: GetterQuery<ITravel>, @Request() request: ExRequest) {
    const filter: Condition<ITravel> = {
      $and: [{ historic: false }, { $or: [{ state: 'approved' }, { state: 'underExamination' }, { state: 'refunded' }] }]
    }
    if (request.user!.projects.supervised.length > 0) {
      filter.$and.push({ project: { $in: request.user!.projects.supervised } })
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
  public async postAny(@Body() requestBody: SetterBody<TravelPost>, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { editor: request.user?._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic && oldObject.state !== 'refunded' && checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
    })
  }

  @Delete()
  public async deleteAny(@Query() _id: _id, @Request() request: ExRequest) {
    return await this.deleter(Travel, {
      _id: _id,
      async checkOldObject(oldObject: TravelDoc) {
        return checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
      }
    })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  public async postExpenseToAny(
    @Query('parentId') parentId: _id,
    @Body() requestBody: SetterBody<TravelExpense>,
    @Request() request: ExRequest
  ) {
    return await this.setterForArrayElement(Travel, {
      requestBody,
      parentId,
      arrayElementKey: 'expenses',
      allowNew: true,
      async checkOldObject(oldObject) {
        if (
          !oldObject.historic &&
          oldObject.state === 'underExamination' &&
          checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
        ) {
          await documentFileHandler(['cost', 'receipts'], { owner: oldObject.owner._id })(request)
          return true
        } else {
          return false
        }
      },
      sortFn: (a: TravelExpense, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Post('stage')
  @Middlewares(fileHandler.any())
  public async postStageToAny(@Query('parentId') parentId: _id, @Body() requestBody: SetterBody<Stage>, @Request() request: ExRequest) {
    return await this.setterForArrayElement(Travel, {
      requestBody,
      parentId,
      arrayElementKey: 'stages',
      allowNew: true,
      async checkOldObject(oldObject) {
        if (
          !oldObject.historic &&
          oldObject.state === 'underExamination' &&
          checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
        ) {
          await documentFileHandler(['cost', 'receipts'], { owner: oldObject.owner._id })(request)
          return true
        } else {
          return false
        }
      },
      sortFn: (a: Stage, b) => new Date(a.departure).valueOf() - new Date(b.departure).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpeneseFromAny(@Query() _id: _id, @Query() parentId: _id, @Request() request: ExRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      async checkOldObject(oldObject: TravelDoc) {
        return (
          !oldObject.historic &&
          oldObject.state === 'underExamination' &&
          checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
        )
      }
    })
  }

  @Delete('stage')
  public async deleteStageFromAny(@Query() _id: _id, @Query() parentId: _id, @Request() request: ExRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'stages',
      async checkOldObject(oldObject: TravelDoc) {
        return (
          !oldObject.historic &&
          oldObject.state === 'underExamination' &&
          checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
        )
      }
    })
  }

  @Post('refunded')
  public async postRefunded(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'refunded' as TravelState, editor: request.user?._id })

    const cb = async (travel: ITravel) => {
      sendNotification(travel)
      sendViaMail(travel)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
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
          oldObject.state === 'underExamination' &&
          checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
        ) {
          await oldObject.saveToHistory()
          await oldObject.save()
          return true
        } else {
          return false
        }
      }
    })
  }

  @Post('approved')
  public async postAnyApproved(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'approved' as TravelState, editor: request.user?._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      cb: (e: ITravel) => sendNotification(e, 'backToApproved'),
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.state === 'underExamination' && checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)) {
          await oldObject.saveToHistory()
          await oldObject.save()
          return true
        } else {
          return false
        }
      }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getAnyReport(@Query() _id: _id, @Request() request: ExRequest) {
    const filter: Condition<ITravel> = { _id, historic: false, state: 'refunded' }
    if (request.user!.projects.supervised.length > 0) {
      filter.project = { $in: request.user!.projects.supervised }
    }
    const travel = await Travel.findOne(filter).lean()
    if (travel) {
      const report = await reportPrinter.print(travel, request.user!.settings.language)
      this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(travel.name)}.pdf`)
      this.setHeader('Content-Type', 'application/pdf')
      this.setHeader('Content-Length', report.length)
      return Readable.from([report])
    } else {
      throw new NotFoundError(`No travel with id: '${_id}' found or not allowed`)
    }
  }
}

@Tags('Travel')
@Route('refunded/travel')
@Security('cookieAuth', ['refunded/travel'])
@Security('httpBearer', ['refunded/travel'])
export class TravelRefundedController extends Controller {
  @Get()
  public async getRefunded(@Queries() query: GetterQuery<ITravel>, @Request() request: ExRequest) {
    const filter: Condition<ITravel> = { historic: false, state: 'refunded' }
    if (request.user!.projects.supervised.length > 0) {
      filter.project = { $in: request.user!.projects.supervised }
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
  public async getRefundedReport(@Query() _id: _id, @Request() request: ExRequest) {
    const filter: Condition<ITravel> = { _id, historic: false, state: 'refunded' }
    if (request.user!.projects.supervised.length > 0) {
      filter.project = { $in: request.user!.projects.supervised }
    }
    const travel = await Travel.findOne(filter).lean()
    if (travel) {
      const report = await reportPrinter.print(travel, request.user!.settings.language)
      this.setHeader('Content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(travel.name)}.pdf`)
      this.setHeader('Content-Type', 'application/pdf')
      this.setHeader('Content-Length', report.length)
      return Readable.from([report])
    } else {
      throw new NotFoundError(`No travel with id: '${_id}' found or not allowed`)
    }
  }
}
