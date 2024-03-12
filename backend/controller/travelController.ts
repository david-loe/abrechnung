import { Route, Get, Tags, Security, Queries, Post, Body, Delete, Query, Request, Middlewares, Produces } from 'tsoa'
import { Controller, GetterQuery } from './controller.js'
import Travel, { TravelDoc } from '../models/travel.js'
import Organisation from '../models/organisation.js'
import { TravelState, Travel as ITravel, _id } from '../../common/types.js'
import { Request as ExRequest } from 'express'
import multer from 'multer'
import { documentFileHandler } from '../helper.js'
import { ExpensePost, IdDocument, TravelApplication, TravelPost } from './types.js'
import i18n from '../i18n.js'
import { sendTravelNotificationMail } from '../mail/mail.js'
import { generateTravelReport } from '../pdf/travel.js'
import User from '../models/user.js'
import { writeToDisk } from '../pdf/helper.js'

const fileHandler = multer({ limits: { fileSize: 16000000 } })

@Tags('Travel')
@Route('api/travel')
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
    return await this.deleter(Travel, { _id: _id, checkOldObject: this.checkOwner(request.user!) })
  }

  @Post()
  public async postTravel(@Body() requestBody: TravelPost, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { editor: request.user?._id })

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb: sendTravelNotificationMail,
      allowNew: false,
      checkOldObject: async (oldObject: TravelDoc) => oldObject.owner._id.equals(request.user!._id) && oldObject.state !== 'refunded'
    })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  public async postExpense(@Query('parentId') parentId: _id, @Body() requestBody: ExpensePost, @Request() request: ExRequest) {
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
          throw new Error('alerts.request.unauthorized')
        }
      },
      sortFn: (a, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Post('stage')
  @Middlewares(fileHandler.any())
  public async postStage(@Query('parentId') parentId: _id, @Body() requestBody: ExpensePost, @Request() request: ExRequest) {
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
          throw new Error('alerts.request.unauthorized')
        }
      },
      sortFn: (a, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpenese(@Query() _id: _id, @Query() parentId: _id, @Request() request: ExRequest) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      async checkOldObject(oldObject) {
        if (!oldObject.historic && oldObject.state === 'approved' && request.user!._id.equals(oldObject.owner._id)) {
          return true
        } else {
          throw new Error('alerts.request.unauthorized')
        }
      }
    })
  }

  @Post('appliedFor')
  public async postInWork(@Body() requestBody: TravelApplication, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, {
      state: 'appliedFor' as TravelState,
      owner: request.user?._id,
      editor: request.user?._id,
      lastPlaceOfWork: { country: requestBody.destinationPlace.country, place: '' }
    })

    if (!extendedBody.name) {
      var date = new Date()
      extendedBody.name =
        i18n.t('labels.expenses', { lng: request.user!.settings.language }) +
        ' ' +
        i18n.t('monthsShort.' + date.getUTCMonth(), { lng: request.user!.settings.language }) +
        ' ' +
        date.getUTCFullYear()
    }
    return await this.setter(Travel, { requestBody: extendedBody, checkOldObject: this.checkOwner(request.user!), allowNew: true })
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
      throw new Error(`No expense report found or unauthorized`)
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

@Tags('Examine', 'Travel')
@Route('api/examine/travel')
@Security('cookieAuth', ['examine/travel'])
export class TravelExamineController extends Controller {
  @Get()
  public async getTravel(@Queries() query: GetterQuery<ITravel>) {
    const sortFn = (a: ITravel, b: ITravel) => (a.updatedAt as Date).valueOf() - (b.updatedAt as Date).valueOf()
    return await this.getter(Travel, {
      query,
      filter: { $and: [{ historic: false }, { $or: [{ state: 'underExamination' }, { state: 'refunded' }] }] },
      projection: { history: 0, historic: 0, expenses: 0 },
      allowedAdditionalFields: ['expenses', 'stages'],
      sortFn
    })
  }

  @Delete()
  public async deleteTravel(@Query() _id: _id) {
    return await this.deleter(Travel, { _id: _id })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  public async postExpense(@Query('parentId') parentId: _id, @Body() requestBody: ExpensePost, @Request() request: ExRequest) {
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
          throw new Error('alerts.request.unauthorized')
        }
      },
      sortFn: (a, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpenese(@Query() _id: _id, @Query() parentId: _id) {
    return await this.deleterForArrayElement(Travel, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      async checkOldObject(oldObject) {
        if (!oldObject.historic && oldObject.state === 'underExamination') {
          return true
        } else {
          throw new Error('alerts.request.unauthorized')
        }
      }
    })
  }

  @Post('refunded')
  public async postUnderExamination(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'refunded' as TravelState, editor: request.user?._id })

    const cb = async (travel: ITravel) => {
      const org = await Organisation.findOne({ _id: travel.organisation._id })
      const subfolder = org ? org.subfolderPath : ''
      sendTravelNotificationMail(travel)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
        await writeToDisk(
          '/reports/travel/' +
            subfolder +
            travel.owner.name.familyName +
            ' ' +
            travel.owner.name.givenName[0] +
            ' - ' +
            travel.name +
            '.pdf',
          await generateTravelReport(travel)
        )
      }
    }

    return await this.setter(Travel, {
      requestBody: extendedBody,
      cb,
      allowNew: false,
      async checkOldObject(oldObject: TravelDoc) {
        if (oldObject.state === 'underExamination') {
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
