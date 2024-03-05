import { Route, Get, Tags, Security, Queries, Post, Body, Delete, Query, Request, Middlewares, Produces } from 'tsoa'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import ExpenseReport, { ExpenseReportDoc } from '../models/expenseReport.js'
import { ExpenseReportState, ExpenseReport as IExpenseReport, _id } from '../../common/types.js'
import { Request as ExRequest } from 'express'
import multer from 'multer'
import { documentFileHandler } from '../helper.js'
import { ExpensePost, IdDocument } from './types.js'
import i18n from '../i18n.js'
import { sendExpenseReportNotificationMail } from '../mail/mail.js'
import { generateExpenseReportReport } from '../pdf/expenseReport.js'
import User from '../models/user.js'

const fileHandler = multer({ limits: { fileSize: 16000000 } })

@Tags('ExpenseReport')
@Route('api/expenseReport')
@Security('cookieAuth', ['user'])
export class ExpenseReportController extends Controller {
  @Get()
  public async getExpenseReport(@Queries() query: GetterQuery<IExpenseReport>, @Request() request: ExRequest) {
    const sortFn = (a: IExpenseReport, b: IExpenseReport) => (a.createdAt as Date).valueOf() - (b.createdAt as Date).valueOf()
    return await this.getter(ExpenseReport, { query, filter: { owner: request.user!._id, historic: false }, projection: { history: 0, historic: 0, expenses: 0 }, allowedAdditionalFields: ['expenses'], sortFn })
  }
  @Delete()
  public async deleteExpenseReport(@Query() _id: _id, @Request() request: ExRequest) {
    return await this.deleter(ExpenseReport, { _id: _id, checkOldObject: this.checkOwner(request.user!) })
  }
  
  @Post('expense')
  @Middlewares(fileHandler.any())
  public async postExpense(@Query('parentId') parentId: _id, @Body() requestBody: ExpensePost, @Request() request: ExRequest){
    return await this.setterForArrayElement(ExpenseReport, {requestBody, parentId, arrayElementKey: 'expenses', allowNew: true, async checkOldObject(oldObject) {
      if(!oldObject.historic && oldObject.state === 'inWork' && request.user!._id.equals(oldObject.owner._id)){
        await documentFileHandler(['cost', 'receipts'], true)(request)
        return true
      }else{
        throw new Error('alerts.request.unauthorized')
      }
    }, sortFn: (a, b) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()})
  }

  @Delete('expense')
  public async deleteExpenese(@Query() _id: _id, @Query() parentId: _id, @Request() request: ExRequest ){
    return await this.deleterForArrayElement(ExpenseReport, {_id, parentId, arrayElementKey: 'expenses', async checkOldObject(oldObject) {
      if(!oldObject.historic && oldObject.state === 'inWork' && request.user!._id.equals(oldObject.owner._id)){
        return true
      }else{
        throw new Error('alerts.request.unauthorized')
      }
    }})
  }

  @Post('inWork')
  public async postInWork(@Body() requestBody: {organisation: IdDocument;_id?: _id; name?: string}, @Request() request: ExRequest ){
    const extendedBody = Object.assign(requestBody, {state: 'inWork' as ExpenseReportState, owner: request.user?._id, editor: request.user?._id})
    
    if (!extendedBody.name) {
      var date = new Date()
      extendedBody.name =
        i18n.t('labels.expenses', { lng: request.user!.settings.language }) +
        ' ' +
        i18n.t('monthsShort.' + date.getUTCMonth(), { lng: request.user!.settings.language }) +
        ' ' +
        date.getUTCFullYear()
    }
    return await this.setter(ExpenseReport, {requestBody: extendedBody, checkOldObject: this.checkOwner(request.user!), allowNew: true})
  }

  @Post('underExamination')
  public async postUnderExamination(@Body() requestBody: {_id: _id; comment?: string}, @Request() request: ExRequest ){
    const extendedBody = Object.assign(requestBody, {state: 'underExamination' as ExpenseReportState, editor: request.user?._id})
  
    return await this.setter(ExpenseReport, {requestBody: extendedBody,cb: sendExpenseReportNotificationMail, allowNew: false, async checkOldObject(oldObject: ExpenseReportDoc){
      if (oldObject.owner._id.equals(request.user!._id) && oldObject.state === 'inWork') {
        await oldObject.saveToHistory()
        await oldObject.save()
        return true
      } else {
        return false
      }
    }})
  }

  @Get('report')
  @Produces("application/pdf")
  public async getReport(@Query() _id: _id, @Request() request: ExRequest ){
    const expenseReport = await ExpenseReport.findOne({
      _id: _id,
      owner: request.user!._id,
      historic: false,
      state: 'refunded'
    }).lean()
    if (expenseReport) {
      const report = await generateExpenseReportReport(expenseReport)
      request.res?.setHeader('Content-disposition', 'attachment; filename=' + expenseReport.name + '.pdf')
      request.res?.setHeader('Content-Type', 'application/pdf')
      request.res?.setHeader('Content-Length', report.length)
      request.res?.send(Buffer.from(report))
    } else {
      throw new Error(`No expense report found or unauthorized`)
    }
  }

  @Get('examiner')
  public async getExaminer(){
    return await this.getter(User, {query: {limit: 5}, filter: { 'access.examine/expenseReport': true }, projection: { name: 1, email: 1 } })
  }
}

@Tags('Admin', 'ExpenseReport')
@Route('api/admin/expenseReport')
@Security('cookieAuth', ['admin'])
export class ExpenseReportAdminController extends Controller {
  @Post()
  public async postExpenseReport(@Body() requestBody: SetterBody<IExpenseReport>) {
    return await this.setter(ExpenseReport, { requestBody: requestBody })
  }
  @Delete()
  public async deleteExpenseReport(@Query() _id: _id) {
    return await this.deleter(ExpenseReport, { _id: _id })
  }
}
