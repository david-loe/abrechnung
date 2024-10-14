import { Request as ExRequest } from 'express'
import { Condition } from 'mongoose'
import { Body, Delete, Get, Middlewares, Post, Produces, Queries, Query, Request, Route, Security } from 'tsoa'
import { Travel as ITravel, Locale, Stage, TravelExpense, TravelState, _id } from '../../common/types.js'
import { checkIfUserIsProjectSupervisor, documentFileHandler, fileHandler, writeToDisk } from '../helper.js'
import i18n from '../i18n.js'
import { sendNotificationMail } from '../mail/mail.js'
import Travel, { TravelDoc } from '../models/travel.js'
import User from '../models/user.js'
import { generateAdvanceReport } from '../pdf/advance.js'
import { writeToDiskFilePath } from '../pdf/helper.js'
import { generateTravelReport } from '../pdf/travel.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { AuthorizationError, NotAllowedError } from './error.js'
import { IdDocument, TravelApplication, TravelPost } from './types.js'

@Route('travel')
@Security('cookieAuth', ['user'])
export class TravelController extends Controller {
  @Get()
  public async getTravel(@Queries() query: GetterQuery<ITravel>, @Request() request: ExRequest) {
    const sortFn = (a: ITravel, b: ITravel) => (b.startDate as Date).valueOf() - (a.startDate as Date).valueOf()
    return await this.getter(Travel, {
      query,
      filter: { owner: request.user!._id, historic: false },
      projection: { history: 0, historic: 0, expenses: 0, stages: 0, days: 0 },
      allowedAdditionalFields: ['expenses', 'stages', 'days'],
      sortFn
    })
  }
  @Delete()
  public async deleteTravel(@Query() _id: _id, @Request() request: ExRequest) {
    return await this.deleter(Travel, {
      _id: _id,
      checkOldObject: async (oldObject: TravelDoc) => !oldObject.historic && oldObject.owner._id.equals(request.user!._id)
    })
  }

  @Post()
  public async postTravel(@Body() requestBody: SetterBody<TravelPost>, @Request() request: ExRequest) {
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
  public async postExpense(
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
  public async postStage(@Query('parentId') parentId: _id, @Body() requestBody: SetterBody<Stage>, @Request() request: ExRequest) {
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
  public async deleteExpenese(@Query() _id: _id, @Query() parentId: _id, @Request() request: ExRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic && oldObject.state === 'approved' && request.user!._id.equals(oldObject.owner._id)
    })
  }

  @Delete('stage')
  public async deleteStage(@Query() _id: _id, @Query() parentId: _id, @Request() request: ExRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'stages',
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic && oldObject.state === 'approved' && request.user!._id.equals(oldObject.owner._id)
    })
  }

  @Post('appliedFor')
  public async postInWork(@Body() requestBody: TravelApplication, @Request() request: ExRequest) {
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
        var date = new Date(extendedBody.startDate)
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
      cb: sendNotificationMail,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic &&
        (oldObject.state === 'appliedFor' || oldObject.state === 'rejected' || oldObject.state === 'approved') &&
        request.user!._id.equals(oldObject.owner._id) &&
        request.user!.access['appliedFor:travel'],
      allowNew: true
    })
  }

  @Post('approved')
  public async postApproved(@Body() requestBody: TravelApplication, @Request() request: ExRequest) {
    var extendedBody: SetterBody<ITravel> = requestBody
    if (!extendedBody._id) {
      if (!request.user!.access['approved:travel']) {
        throw new AuthorizationError()
      } else if (!extendedBody.name && extendedBody.startDate) {
        var date = new Date(extendedBody.startDate)
        extendedBody.name =
          extendedBody.destinationPlace?.place +
          ' ' +
          i18n.t('monthsShort.' + date.getUTCMonth(), { lng: request.user!.settings.language }) +
          ' ' +
          date.getUTCFullYear()
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
  public async postUnderExamination(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'underExamination' as TravelState, editor: request.user?._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendNotificationMail,
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
  public async getReport(@Query() _id: _id, @Request() request: ExRequest) {
    const travel = await Travel.findOne({
      _id: _id,
      owner: request.user!._id,
      historic: false,
      state: 'refunded'
    }).lean()
    if (travel) {
      const report = await generateTravelReport(travel, request.user!.settings.language)
      request.res?.setHeader('Content-disposition', 'attachment; filename=' + travel.name + '.pdf')
      request.res?.setHeader('Content-Type', 'application/pdf')
      request.res?.setHeader('Content-Length', report.length)
      request.res?.send(Buffer.from(report))
    } else {
      throw new NotAllowedError(`No travel with id: '${_id}' found or not allowed`)
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

@Route('approve/travel')
@Security('cookieAuth', ['approve/travel'])
export class TravelApproveController extends Controller {
  @Get()
  public async getTravel(@Queries() query: GetterQuery<ITravel>, @Request() request: ExRequest) {
    const filter: Condition<ITravel> = { $and: [{ historic: false }, { $or: [{ state: 'appliedFor' }, { state: 'approved' }] }] }
    if (request.user!.projects.supervised.length > 0) {
      filter.$and.push({ project: { $in: request.user!.projects.supervised } })
    }
    const sortFn = (a: ITravel, b: ITravel) => (b.updatedAt as Date).valueOf() - (a.updatedAt as Date).valueOf()
    return await this.getter(Travel, {
      query,
      filter,
      projection: { history: 0, historic: 0, expenses: 0, stages: 0, days: 0 },
      sortFn
    })
  }

  @Post('approved')
  public async postApproved(
    @Body() requestBody: (TravelApplication & { owner: IdDocument }) | { _id: _id; comment?: string },
    @Request() request: ExRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: 'approved' as TravelState, editor: request.user?._id })
    if (!extendedBody._id) {
      ;(extendedBody as any).lastPlaceOfWork = { country: (extendedBody as TravelApplication).destinationPlace?.country, place: '' }
      if (!(extendedBody as TravelApplication).name && (extendedBody as TravelApplication).startDate) {
        var date = new Date((extendedBody as TravelApplication).startDate!)
        ;(extendedBody as TravelApplication).name =
          (extendedBody as TravelApplication).destinationPlace?.place +
          ' ' +
          i18n.t('monthsShort.' + date.getUTCMonth(), { lng: request.user!.settings.language }) +
          ' ' +
          date.getUTCFullYear()
      }
    }
    const cb = async (travel: ITravel) => {
      sendNotificationMail(travel)
      if (
        travel.advance.amount !== null &&
        travel.advance.amount > 0 &&
        process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true'
      ) {
        await writeToDisk(await writeToDiskFilePath(travel), await generateAdvanceReport(travel, i18n.language as Locale))
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
  public async postRejected(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'rejected' as TravelState, editor: request.user?._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendNotificationMail,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) =>
        oldObject.state === 'appliedFor' && checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
    })
  }
}

@Route('examine/travel')
@Security('cookieAuth', ['examine/travel'])
export class TravelExamineController extends Controller {
  @Get()
  public async getTravel(@Queries() query: GetterQuery<ITravel>, @Request() request: ExRequest) {
    const filter: Condition<ITravel> = { $and: [{ historic: false }, { $or: [{ state: 'underExamination' }, { state: 'refunded' }] }] }
    if (request.user!.projects.supervised.length > 0) {
      filter.$and.push({ project: { $in: request.user!.projects.supervised } })
    }
    const sortFn = (a: ITravel, b: ITravel) => (b.updatedAt as Date).valueOf() - (a.updatedAt as Date).valueOf()
    return await this.getter(Travel, {
      query,
      filter,
      projection: { history: 0, historic: 0, expenses: 0, stages: 0, days: 0 },
      allowedAdditionalFields: ['expenses', 'stages', 'days'],
      sortFn
    })
  }

  @Post()
  public async postTravel(@Body() requestBody: SetterBody<TravelPost>, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { editor: request.user?._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic && oldObject.state !== 'refunded' && checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
    })
  }

  @Delete()
  public async deleteTravel(@Query() _id: _id, @Request() request: ExRequest) {
    return await this.deleter(Travel, {
      _id: _id,
      async checkOldObject(oldObject: TravelDoc) {
        return checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
      }
    })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  public async postExpense(
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
  public async postStage(@Query('parentId') parentId: _id, @Body() requestBody: SetterBody<Stage>, @Request() request: ExRequest) {
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
  public async deleteExpenese(@Query() _id: _id, @Query() parentId: _id, @Request() request: ExRequest) {
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
  public async deleteStage(@Query() _id: _id, @Query() parentId: _id, @Request() request: ExRequest) {
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
      sendNotificationMail(travel)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
        await writeToDisk(await writeToDiskFilePath(travel), await generateTravelReport(travel, i18n.language as Locale))
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
  public async postApproved(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'approved' as TravelState, editor: request.user?._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      allowNew: false,
      cb: (e: ITravel) => sendNotificationMail(e, 'backToApproved'),
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
  public async getReport(@Query() _id: _id, @Request() request: ExRequest) {
    const filter: Condition<ITravel> = { _id, historic: false, state: 'refunded' }
    if (request.user!.projects.supervised.length > 0) {
      filter.project = { $in: request.user!.projects.supervised }
    }
    const travel = await Travel.findOne(filter).lean()
    if (travel) {
      const report = await generateTravelReport(travel, request.user!.settings.language)
      request.res?.setHeader('Content-disposition', 'attachment; filename=' + travel.name + '.pdf')
      request.res?.setHeader('Content-Type', 'application/pdf')
      request.res?.setHeader('Content-Length', report.length)
      request.res?.send(Buffer.from(report))
    } else {
      throw new NotAllowedError(`No travel with id: '${_id}' found or not allowed`)
    }
  }
}
