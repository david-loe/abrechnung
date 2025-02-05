import { Request as ExRequest } from 'express'
import { Condition } from 'mongoose'
import { Body, Delete, Get, Middlewares, Post, Produces, Queries, Query, Request, Route, Security } from 'tsoa'
import {
  Expense,
  HealthCareCostState,
  HealthCareCost as IHealthCareCost,
  Organisation as IOrganisation,
  Locale,
  _id
} from '../../common/types.js'
import { checkIfUserIsProjectSupervisor, documentFileHandler, fileHandler, writeToDisk } from '../helper.js'
import i18n from '../i18n.js'
import HealthCareCost, { HealthCareCostDoc } from '../models/healthCareCost.js'
import Organisation from '../models/organisation.js'
import User from '../models/user.js'
import { sendNotification } from '../notifications/notification.js'
import { generateHealthCareCostReport } from '../pdf/healthCareCost.js'
import { sendViaMail, writeToDiskFilePath } from '../pdf/helper.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { AuthorizationError, NotAllowedError } from './error.js'
import { IdDocument, MoneyPlusPost } from './types.js'

@Route('healthCareCost')
@Security('cookieAuth', ['user'])
export class HealthCareCostController extends Controller {
  @Get()
  public async getHealthCareCost(@Queries() query: GetterQuery<IHealthCareCost>, @Request() request: ExRequest) {
    const sortFn = (a: IHealthCareCost, b: IHealthCareCost) => (b.createdAt as Date).valueOf() - (a.createdAt as Date).valueOf()
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
          await documentFileHandler(['cost', 'receipts'])(request)
          return true
        } else {
          return false
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
          return false
        }
      }
    })
  }

  @Post('inWork')
  public async postInWork(
    @Body() requestBody: { project?: IdDocument; insurance?: IdDocument; patientName?: string; _id?: _id; name?: string },
    @Request() request: ExRequest
  ) {
    const extendedBody = Object.assign(requestBody, {
      state: 'inWork' as HealthCareCostState,
      owner: request.user?._id,
      editor: request.user?._id
    })

    if (!extendedBody._id) {
      if (!request.user!.access['inWork:healthCareCost']) {
        throw new AuthorizationError()
      } else if (!extendedBody.name) {
        let date = new Date()
        extendedBody.name =
          requestBody.patientName +
          ' ' +
          i18n.t('monthsShort.' + date.getUTCMonth(), { lng: request.user!.settings.language }) +
          ' ' +
          date.getUTCFullYear()
      }
    }
    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        if (
          (oldObject.owner._id.equals(request.user!._id) &&
            oldObject.state === 'inWork' &&
            request.user!.access['inWork:healthCareCost']) ||
          (oldObject.state === 'underExamination' && oldObject.editor._id.equals(request.user!._id))
        ) {
          await oldObject.saveToHistory()
          await oldObject.save()
          return true
        } else {
          return false
        }
      },
      allowNew: true
    })
  }

  @Post('underExamination')
  public async postUnderExamination(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, { state: 'underExamination' as HealthCareCostState, editor: request.user?._id })

    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb: sendNotification,
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
      const report = await generateHealthCareCostReport(healthCareCost, request.user!.settings.language)
      request.res?.setHeader('Content-disposition', 'attachment; filename=' + healthCareCost.name + '.pdf')
      request.res?.setHeader('Content-Type', 'application/pdf')
      request.res?.setHeader('Content-Length', report.length)
      request.res?.send(Buffer.from(report))
    } else {
      throw new NotAllowedError(`No health care cost with id: '${_id}' found or not allowed`)
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

@Route('examine/healthCareCost')
@Security('cookieAuth', ['examine/healthCareCost'])
export class HealthCareCostExamineController extends Controller {
  @Get()
  public async getHealthCareCost(@Queries() query: GetterQuery<IHealthCareCost>, @Request() request: ExRequest) {
    const filter: Condition<IHealthCareCost> = {
      $and: [{ historic: false }, { $or: [{ state: 'underExamination' }, { state: 'underExaminationByInsurance' }] }]
    }
    if (request.user!.projects.supervised.length > 0) {
      filter.$and.push({ project: { $in: request.user!.projects.supervised } })
    }
    const sortFn = (a: IHealthCareCost, b: IHealthCareCost) => (b.updatedAt as Date).valueOf() - (a.updatedAt as Date).valueOf()
    return await this.getter(HealthCareCost, {
      query,
      filter,
      projection: { history: 0, historic: 0, expenses: 0 },
      allowedAdditionalFields: ['expenses'],
      sortFn
    })
  }

  @Delete()
  public async deleteHealthCareCost(@Query() _id: _id, @Request() request: ExRequest) {
    return await this.deleter(HealthCareCost, {
      _id: _id,
      async checkOldObject(oldObject: IHealthCareCost) {
        return checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
      }
    })
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
        if (
          !oldObject.historic &&
          oldObject.state === 'underExamination' &&
          checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
        ) {
          return true
        } else {
          return false
        }
      }
    })
  }

  @Post('underExaminationByInsurance')
  public async postUnderExaminationByInsurance(@Body() requestBody: { _id: _id; comment?: string }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, {
      state: 'underExaminationByInsurance' as HealthCareCostState,
      editor: request.user?._id
    })

    const cb = async (healthCareCost: IHealthCareCost) => {
      sendNotification(healthCareCost)
      sendViaMail(healthCareCost)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
        await writeToDisk(
          await writeToDiskFilePath(healthCareCost),
          await generateHealthCareCostReport(healthCareCost, i18n.language as Locale)
        )
      }
    }

    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb,
      allowNew: false,
      async checkOldObject(oldObject: HealthCareCostDoc) {
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

  @Post('inWork')
  public async postBackInWork(
    @Body()
    requestBody: {
      project?: IdDocument
      insurance?: IdDocument
      patientName?: string
      _id?: _id
      name?: string
      owner?: IdDocument
      comment?: string
    },
    @Request() request: ExRequest
  ) {
    const extendedBody = Object.assign(requestBody, { state: 'inWork' as HealthCareCostState, editor: request.user?._id })
    if (!extendedBody._id && !extendedBody.name) {
      let date = new Date()
      extendedBody.name =
        requestBody.patientName +
        ' ' +
        i18n.t('monthsShort.' + date.getUTCMonth(), { lng: request.user!.settings.language }) +
        ' ' +
        date.getUTCFullYear()
    }
    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb: (e: IHealthCareCost) => sendNotification(e, extendedBody._id ? 'backToInWork' : undefined),
      allowNew: true,
      async checkOldObject(oldObject: HealthCareCostDoc) {
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
    const filter: Condition<IHealthCareCost> = { _id, historic: false, state: 'underExaminationByInsurance' }
    if (request.user!.projects.supervised.length > 0) {
      filter.project = { $in: request.user!.projects.supervised }
    }
    const healthCareCost = await HealthCareCost.findOne(filter).lean()
    if (healthCareCost) {
      const report = await generateHealthCareCostReport(healthCareCost, request.user!.settings.language)
      request.res?.setHeader('Content-disposition', 'attachment; filename=' + healthCareCost.name + '.pdf')
      request.res?.setHeader('Content-Type', 'application/pdf')
      request.res?.setHeader('Content-Length', report.length)
      request.res?.send(Buffer.from(report))
    } else {
      throw new NotAllowedError(`No health care cost with id: '${_id}' found or not allowed`)
    }
  }

  @Get('organisation')
  public async getOrganisation(@Queries() query: GetterQuery<IOrganisation>) {
    return await this.getter(Organisation, { query })
  }
}

@Route('confirm/healthCareCost')
@Security('cookieAuth', ['confirm/healthCareCost'])
export class HealthCareCostConfirmController extends Controller {
  @Get()
  public async getHealthCareCost(@Queries() query: GetterQuery<IHealthCareCost>, @Request() request: ExRequest) {
    const filter: Condition<IHealthCareCost> = {
      $and: [{ historic: false }, { $or: [{ state: 'underExaminationByInsurance' }, { state: 'refunded' }] }]
    }
    if (request.user!.projects.supervised.length > 0) {
      filter.$and.push({ project: { $in: request.user!.projects.supervised } })
    }
    const sortFn = (a: IHealthCareCost, b: IHealthCareCost) => (b.updatedAt as Date).valueOf() - (a.updatedAt as Date).valueOf()
    return await this.getter(HealthCareCost, {
      query,
      filter,
      projection: { history: 0, historic: 0, expenses: 0 },
      allowedAdditionalFields: ['expenses'],
      sortFn
    })
  }

  @Post('refunded')
  @Middlewares(fileHandler.any())
  public async postRefunded(@Body() requestBody: { _id: _id; comment?: string; refundSum: MoneyPlusPost }, @Request() request: ExRequest) {
    const extendedBody = Object.assign(requestBody, {
      state: 'refunded' as HealthCareCostState,
      editor: request.user?._id
    })

    const cb = async (healthCareCost: IHealthCareCost) => {
      sendNotification(healthCareCost)
      sendViaMail(healthCareCost)
      if (process.env.BACKEND_SAVE_REPORTS_ON_DISK.toLowerCase() === 'true') {
        await writeToDisk(
          await writeToDiskFilePath(healthCareCost),
          await generateHealthCareCostReport(healthCareCost, i18n.language as Locale)
        )
      }
    }

    return await this.setter(HealthCareCost, {
      requestBody: extendedBody,
      cb,
      allowNew: false,
      async checkOldObject(oldObject: HealthCareCostDoc) {
        if (oldObject.state === 'underExaminationByInsurance' && checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)) {
          await documentFileHandler(['refundSum', 'receipts'], { owner: oldObject.owner._id })(request)
          await oldObject.saveToHistory()
          await oldObject.save()
          return true
        } else {
          return false
        }
      }
    })
  }
  @Delete()
  public async deleteHealthCareCost(@Query() _id: _id, @Request() request: ExRequest) {
    return await this.deleter(HealthCareCost, {
      _id: _id,
      async checkOldObject(oldObject: IHealthCareCost) {
        return checkIfUserIsProjectSupervisor(request.user!, oldObject.project._id)
      }
    })
  }

  @Get('report')
  @Produces('application/pdf')
  public async getReport(@Query() _id: _id, @Request() request: ExRequest) {
    const filter: Condition<IHealthCareCost> = {
      $and: [{ _id, historic: false }, { $or: [{ state: 'refunded' }, { state: 'underExaminationByInsurance' }] }]
    }
    if (request.user!.projects.supervised.length > 0) {
      filter.$and.push({ project: { $in: request.user!.projects.supervised } })
    }
    const healthCareCost = await HealthCareCost.findOne(filter).lean()
    if (healthCareCost) {
      const report = await generateHealthCareCostReport(healthCareCost, request.user!.settings.language)
      request.res?.setHeader('Content-disposition', 'attachment; filename=' + healthCareCost.name + '.pdf')
      request.res?.setHeader('Content-Type', 'application/pdf')
      request.res?.setHeader('Content-Length', report.length)
      request.res?.send(Buffer.from(report))
    } else {
      throw new NotAllowedError(`No health care cost with id: '${_id}' found or not allowed`)
    }
  }
}
