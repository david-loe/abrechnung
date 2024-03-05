import { Route, Get, Tags, Security, Queries, Post, Body, Delete, Query, Request, Path, Middlewares } from 'tsoa'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import ExpenseReport from '../models/expenseReport.js'
import { Expense, ExpenseReport as IExpenseReport, _id } from '../../common/types.js'
import { Request as ExRequest } from 'express'
import multer from 'multer'
import { documentFileHandler } from '../helper.js'
import { ExpensePost } from './types.js'

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
