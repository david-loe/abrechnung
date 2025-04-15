import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from 'tsoa'
import { Currency as ICurrency, _id, locales } from '../../common/types.js'
import Currency, { currencySchema } from '../models/currency.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Tags('Currency')
@Route('currency')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class CurrencyController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<ICurrency>) {
    return await this.getter(Currency, { query })
  }
}

@Tags('Currency')
@Route('admin/currency')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class CurrencyAdminController extends Controller {
  @Post()
  public async post(@Body() requestBody: SetterBody<ICurrency>) {
    return await this.setter(Currency, { requestBody: requestBody, allowNew: true })
  }
  @Post('bulk')
  public async postMany(@Body() requestBody: SetterBody<ICurrency>[]) {
    return await this.insertMany(Currency, { requestBody })
  }
  @Delete()
  public async delete(@Query() _id: _id) {
    return await this.deleter(Currency, { _id: _id })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(currencySchema().obj, locales) }
  }
}
