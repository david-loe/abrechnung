import { Request as ExRequest } from 'express'
import multer from 'multer'
import { Body, Delete, Get, Middlewares, Post, Produces, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { Expense, HealthCareCostState, HealthCareCost as IHealthCareCost, Organisation as IOrganisation, _id } from '../../common/types.js'
import { documentFileHandler } from '../helper.js'
import i18n from '../i18n.js'
import { sendHealthCareCostNotificationMail } from '../mail/mail.js'
import HealthCareCost, { HealthCareCostDoc } from '../models/healthCareCost.js'
import Organisation from '../models/organisation.js'
import User from '../models/user.js'
import { generateHealthCareCostReport } from '../pdf/healthCareCost.js'
import { writeToDisk, writeToDiskFilePath } from '../pdf/helper.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { IdDocument, MoneyPlusPost } from './types.js'

const fileHandler = multer({ limits: { fileSize: 16000000 } })

@Tags('HealthCareCost')
@Route('healthCareCost')
@Security('cookieAuth', ['user'])
export class HealthCareCostController extends Controller {
  @Get()
  public async getHealthCareCost(@Queries() query: GetterQuery<IHealthCareCost>, @Request() request: ExRequest) {
    const sortFn = (a: IHealthCareCost, b: IHealthCareCost) => (a.createdAt as Date).valueOf() - (b.createdAt as Date).valueOf()
    return await this.getter(HealthCareCost, {
      query,
      filter: { owner: request.user!._id, historic: false },
      projection: { history: 0, historic: 0, expenses: 0 },
      allowedAdditionalFields: ['expenses'],
      sortFn
    })
  }
  @Delete()
  public async deleteHealthCareCost(@Query() _id: _id, @Request() request: ExRequest) {
    return await this.deleter(HealthCareCost, { _id: _id, checkOldObject: this.checkOwner(request.user!) })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  public async postExpense(@Query('parentId') parentId: _id, @Body() requestBody: SetterBody<Expense>, @Request() request: ExRequest) {
    return await this.setterForArrayElement(HealthCareCost, {
      requestBody,
      parentId,
      arrayElementKey: 'expenses',
      allowNew: true,
      async checkOldObject(oldObject) {
        if (!oldObject.historic && oldObject.state === 'inWork' && request.user!._id.equals(oldObject.owner._id)) {
          await documentFileHandler(['cost', 'receipts'], true)(request)
          return true
        } else {
          throw new Error('alerts.request.unauthorized')
        }
      },
      sortFn: (a: Expense, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpenese(@Query() _id: _id, @Query() parentId: _id, @Request() request: ExRequest) {
    return await this.deleterForArrayElement(HealthCareCost, {
      _id,
      parentId,
      arrayElementKey: 'expenses',
      async checkOldObject(oldObject) {
        if (!oldObject.historic && oldObject.state === 'inWork' && request.user!._id.equals(oldObject.owner._id)) {
          return true
        } else {
          throw new Error('alerts.request.unauthorized')
        }
      }
    })
  }

  @Post('inWork')
  public async postInWork(
    @Body() requestBody: { organisation: IdDocument; insurance: IdDocument; patientName: string; _id?: _id; name?: string },
    @Request() request: ExRequest
  ) {
    const extendedBody = Object.assign(requestBody, {
      state: 'inWork' as HealthCareCostState,
      owner: request.user?._id,
      editor: request.user?._id
    })

    if (!extendedBody.name) {
      var date = new Date()
      extendedBody.name =
        requestBody.patientName +
        ' ' +
        i18n.t('monthsShort.' + date.getUTCMonth(), { lng: request.user!.settings.language }) +
        ' ' +
        date.getUTCFullYear()
    }
    return await this.setter(HealthCareCost, { requestBody: extendedBody, checkOldObject: this.checkOwner(request.user!), allowNew: true })
  }

  @Post('underExamination')
  public async postUnderExamination(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'underExamination' as HealthCareCostState, editor: request.user?._id })

    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb: sendHealthCareCostNotificationMail,
      allowNew: false,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        if (oldObject.owner._id.equals(request.user!._id) && oldObject.state === 'inWork') {
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
    const healthCareCost = await HealthCareCost.findOne({
      $and: [{ _id, owner: request.user!._id, historic: false }, { $or: [{ state: 'refunded' }, { state: 'underExaminationByInsurance' }] }]
    }).lean()
    if (healthCareCost) {
      const report = await generateHealthCareCostReport(healthCareCost)
      request.res?.setHeader('Content-disposition', 'attachment; filename=' + healthCareCost.name + '.pdf')
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
      filter: { 'access.examine/healthCareCost': true },
      projection: { name: 1, email: 1 }
    })
  }
}

@Tags('Examine', 'HealthCareCost')
@Route('examine/healthCareCost')
@Security('cookieAuth', ['examine/healthCareCost'])
export class HealthCareCostExamineController extends Controller {
  @Get()
  public async getHealthCareCost(@Queries() query: GetterQuery<IHealthCareCost>) {
    const sortFn = (a: IHealthCareCost, b: IHealthCareCost) => (a.updatedAt as Date).valueOf() - (b.updatedAt as Date).valueOf()
    return await this.getter(HealthCareCost, {
      query,
      filter: { $and: [{ historic: false }, { $or: [{ state: 'underExamination' }, { state: 'underExaminationByInsurance' }] }] },
      projection: { history: 0, historic: 0, expenses: 0 },
      allowedAdditionalFields: ['expenses'],
      sortFn
    })
  }

  @Delete()
  public async deleteHealthCareCost(@Query() _id: _id) {
    return await this.deleter(HealthCareCost, { _id: _id })
  }

  @Post('expense')
  @Middlewares(fileHandler.any())
  public async postExpense(@Query('parentId') parentId: _id, @Body() requestBody: SetterBody<Expense>, @Request() request: ExRequest) {
    return await this.setterForArrayElement(HealthCareCost, {
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
      sortFn: (a: Expense, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()
    })
  }

  @Delete('expense')
  public async deleteExpenese(@Query() _id: _id, @Query() parentId: _id) {
    return await this.deleterForArrayElement(HealthCareCost, {
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

  @Post('underExaminationByInsurance')
  public async postUnderExamination(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, {
      state: 'underExaminationByInsurance' as HealthCareCostState,
      editor: request.user?._id
    })

    const cb = async (healthCareCost: IHealthCareCost) => {
      sendHealthCareCostNotificationMail(healthCareCost)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
        await writeToDisk(await writeToDiskFilePath(healthCareCost), await generateHealthCareCostReport(healthCareCost))
      }
    }

    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb,
      allowNew: false,
      async checkOldObject(oldObject: HealthCareCostDoc) {
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
    const healthCareCost = await HealthCareCost.findOne({ _id, historic: false, state: 'underExaminationByInsurance' }).lean()
    if (healthCareCost) {
      const report = await generateHealthCareCostReport(healthCareCost)
      request.res?.setHeader('Content-disposition', 'attachment; filename=' + healthCareCost.name + '.pdf')
      request.res?.setHeader('Content-Type', 'application/pdf')
      request.res?.setHeader('Content-Length', report.length)
      request.res?.send(Buffer.from(report))
    } else {
      throw new Error(`No expense report found or unauthorized`)
    }
  }

  @Get('organisation')
  public async getOrganisation(@Queries() query: GetterQuery<IOrganisation>) {
    return await this.getter(Organisation, { query })
  }
}

@Tags('Confirm', 'HealthCareCost')
@Route('confirm/healthCareCost')
@Security('cookieAuth', ['confirm/healthCareCost'])
export class HealthCareCostConfirmController extends Controller {
  @Get()
  public async getHealthCareCost(@Queries() query: GetterQuery<IHealthCareCost>) {
    const sortFn = (a: IHealthCareCost, b: IHealthCareCost) => (a.updatedAt as Date).valueOf() - (b.updatedAt as Date).valueOf()
    return await this.getter(HealthCareCost, {
      query,
      filter: { $and: [{ historic: false }, { $or: [{ state: 'underExaminationByInsurance' }, { state: 'refunded' }] }] },
      projection: { history: 0, historic: 0, expenses: 0 },
      allowedAdditionalFields: ['expenses'],
      sortFn
    })
  }

  @Post('refunded')
  @Middlewares(fileHandler.any())
  public async postUnderExamination(
    @Body() requestBody: { _id: _id; comment?: string; refundSum: MoneyPlusPost },
    @Request() request: ExRequest
  ) {
    const extendedBody = Object.assign(requestBody, {
      state: 'refunded' as HealthCareCostState,
      editor: request.user?._id
    })

    const cb = async (healthCareCost: IHealthCareCost) => {
      sendHealthCareCostNotificationMail(healthCareCost)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
        await writeToDisk(await writeToDiskFilePath(healthCareCost), await generateHealthCareCostReport(healthCareCost))
      }
    }

    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb,
      allowNew: false,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        if (oldObject.state === 'underExaminationByInsurance') {
          await documentFileHandler(['refundSum', 'receipts'])(request)
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
    const healthCareCost = await HealthCareCost.findOne({
      $and: [{ _id, historic: false }, { $or: [{ state: 'refunded' }, { state: 'underExaminationByInsurance' }] }]
    }).lean()
    if (healthCareCost) {
      const report = await generateHealthCareCostReport(healthCareCost)
      request.res?.setHeader('Content-disposition', 'attachment; filename=' + healthCareCost.name + '.pdf')
      request.res?.setHeader('Content-Type', 'application/pdf')
      request.res?.setHeader('Content-Length', report.length)
      request.res?.send(Buffer.from(report))
    } else {
      throw new Error(`No expense report found or unauthorized`)
    }
  }
}
