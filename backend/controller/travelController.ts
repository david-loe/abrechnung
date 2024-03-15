import { Request as ExRequest } from 'express'
import multer from 'multer'
import { Body, Delete, Get, Middlewares, Post, Produces, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { Travel as ITravel, Stage, TravelExpense, TravelState, _id } from '../../common/types.js'
import { documentFileHandler } from '../helper.js'
import i18n from '../i18n.js'
import { sendTravelNotificationMail } from '../mail/mail.js'
import Travel, { TravelDoc } from '../models/travel.js'
import User from '../models/user.js'
import { writeToDisk, writeToDiskFilePath } from '../pdf/helper.js'
import { generateTravelReport } from '../pdf/travel.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { TravelApplication, TravelPost } from './types.js'

const fileHandler = multer({ limits: { fileSize: 16000000 } })

@Tags('Travel')
@Route('travel')
@Security('cookieAuth', ['user'])
export class TravelController extends Controller {
  @Get()
  public async getTravel(@Queries() query: GetterQuery<ITravel>, @Request() request: ExRequest) {
    const sortFn = (a: ITravel, b: ITravel) => (a.startDate as Date).valueOf() - (b.startDate as Date).valueOf()
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
          await documentFileHandler(['cost', 'receipts'], true)(request)
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
          await documentFileHandler(['cost', 'receipts'], true)(request)
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

    if (!extendedBody.name && extendedBody.startDate) {
      var date = new Date(extendedBody.startDate)
      extendedBody.name =
        extendedBody.destinationPlace?.place +
        ' ' +
        i18n.t('monthsShort.' + date.getUTCMonth(), { lng: request.user!.settings.language }) +
        ' ' +
        date.getUTCFullYear()
    }
    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendTravelNotificationMail,
      checkOldObject: async (oldObject: TravelDoc) =>
        !oldObject.historic &&
        (oldObject.state === 'appliedFor' || oldObject.state === 'rejected' || oldObject.state === 'approved') &&
        request.user!._id.equals(oldObject.owner._id),
      allowNew: true
    })
  }

  @Post('underExamination')
  public async postUnderExamination(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'underExamination' as TravelState, editor: request.user?._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendTravelNotificationMail,
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
      const report = await generateTravelReport(travel)
      request.res?.setHeader('Content-disposition', 'attachment; filename=' + travel.name + '.pdf')
      request.res?.setHeader('Content-Type', 'application/pdf')
      request.res?.setHeader('Content-Length', report.length)
      request.res?.send(Buffer.from(report))
    } else {
      throw new Error(`No travel found or unauthorized`)
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

@Tags('Approve', 'Travel')
@Route('approve/travel')
@Security('cookieAuth', ['approve/travel'])
export class TravelApproveController extends Controller {
  @Get()
  public async getTravel(@Queries() query: GetterQuery<ITravel>) {
    const sortFn = (a: ITravel, b: ITravel) => (a.updatedAt as Date).valueOf() - (b.updatedAt as Date).valueOf()
    return await this.getter(Travel, {
      query,
      filter: { $and: [{ historic: false }, { $or: [{ state: 'appliedFor' }, { state: 'approved' }] }] },
      projection: { history: 0, historic: 0, expenses: 0, stages: 0, days: 0 },
      sortFn
    })
  }

  @Post('approved')
  public async postApproved(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'approved' as TravelState, editor: request.user?._id })
    const cb = async (travel: ITravel) => {
      sendTravelNotificationMail(travel)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
        await writeToDisk(await writeToDiskFilePath(travel), await generateTravelReport(travel))
      }
    }

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb,
      allowNew: false,
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.state === 'appliedFor') {
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
      cb: sendTravelNotificationMail,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) => oldObject.state === 'appliedFor'
    })
  }
}

@Tags('Examine', 'Travel')
@Route('examine/travel')
@Security('cookieAuth', ['examine/travel'])
export class TravelExamineController extends Controller {
  @Get()
  public async getTravel(@Queries() query: GetterQuery<ITravel>) {
    const sortFn = (a: ITravel, b: ITravel) => (a.updatedAt as Date).valueOf() - (b.updatedAt as Date).valueOf()
    return await this.getter(Travel, {
      query,
      filter: { $and: [{ historic: false }, { $or: [{ state: 'underExamination' }, { state: 'refunded' }] }] },
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
      checkOldObject: async (oldObject: TravelDoc) => !oldObject.historic && oldObject.state !== 'refunded'
    })
  }

  @Delete()
  public async deleteTravel(@Query() _id: _id) {
    return await this.deleter(Travel, { _id: _id })
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
        if (!oldObject.historic && oldObject.state === 'underExamination') {
          await documentFileHandler(['cost', 'receipts'], true)(request)
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
        if (!oldObject.historic && oldObject.state === 'underExamination') {
          await documentFileHandler(['cost', 'receipts'], true)(request)
          return true
        } else {
          return false
        }
      },
      sortFn: (a: Stage, b) => new Date(a.departure).valueOf() - new Date(b.departure).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpenese(@Query() _id: _id, @Query() parentId: _id) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      checkOldObject: async (oldObject: TravelDoc) => !oldObject.historic && oldObject.state === 'underExamination'
    })
  }

  @Delete('stage')
  public async deleteStage(@Query() _id: _id, @Query() parentId: _id) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'stages',
      checkOldObject: async (oldObject: TravelDoc) => !oldObject.historic && oldObject.state === 'underExamination'
    })
  }

  @Post('refunded')
  public async postRefunded(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'refunded' as TravelState, editor: request.user?._id })

    const cb = async (travel: ITravel) => {
      sendTravelNotificationMail(travel)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
        await writeToDisk(await writeToDiskFilePath(travel), await generateTravelReport(travel))
      }
    }

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb,
      allowNew: false,
      async checkOldObject(oldObject: TravelDoc) {
        if (!oldObject.historic && oldObject.state === 'underExamination') {
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
    const travel = await Travel.findOne({ _id, historic: false, state: 'refunded' }).lean()
    if (travel) {
      const report = await generateTravelReport(travel)
      request.res?.setHeader('Content-disposition', 'attachment; filename=' + travel.name + '.pdf')
      request.res?.setHeader('Content-Type', 'application/pdf')
      request.res?.setHeader('Content-Length', report.length)
      request.res?.send(Buffer.from(report))
    } else {
      throw new Error(`No expense report found or unauthorized`)
    }
  }
}
