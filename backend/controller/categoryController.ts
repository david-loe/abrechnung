import { Types } from 'mongoose'
import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from 'tsoa'
import { Category as ICategory, locales } from '../../common/types.js'
import Category, { categorySchema } from '../models/category.js'
import ExpenseReport from '../models/expenseReport.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Tags('Category')
@Route('category')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class CategoryController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<ICategory>) {
    return await this.getter(Category, { query })
  }
}

@Tags('Category')
@Route('admin/category')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class CategoryAdminController extends Controller {
  @Post()
  public async post(@Body() requestBody: SetterBody<ICategory<Types.ObjectId>>) {
    return await this.setter(Category, { requestBody: requestBody, allowNew: true })
  }
  @Post('bulk')
  public async postMany(@Body() requestBody: SetterBody<ICategory<Types.ObjectId>>[]) {
    return await this.insertMany(Category, { requestBody })
  }
  @Delete()
  public async delete(@Query() _id: string) {
    return await this.deleter(Category, {
      _id: _id,
      referenceChecks: [{ model: ExpenseReport, paths: ['category'], conditions: { historic: false } }],
      minDocumentCount: 1
    })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(categorySchema().obj, locales) }
  }
}
