import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from 'tsoa'
import { Currency as ICurrency, Locale, _id } from '../../common/types.js'
import { mongooseSchemaToVueformSchema } from '../helper.js'
import Currency, { currencySchema } from '../models/currency.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Tags('Currency')
@Route('currency')
@Security('cookieAuth', ['user'])
export class CurrencyController extends Controller {
  @Get()
  public async getCurrency(@Queries() query: GetterQuery<ICurrency>) {
    return await this.getter(Currency, { query })
  }
}

@Tags('Admin', 'Currency')
@Route('admin/currency')
@Security('cookieAuth', ['admin'])
export class CurrencyAdminController extends Controller {
  @Post()
  public async postCurrency(@Body() requestBody: SetterBody<ICurrency>) {
    return await this.setter(Currency, { requestBody: requestBody, allowNew: true })
  }
  @Delete()
  public async deleteCurrency(@Query() _id: _id) {
    return await this.deleter(Currency, { _id: _id })
  }
  @Get('schema')
  public async getSchema(@Query() language: Locale) {
    return mongooseSchemaToVueformSchema(currencySchema.obj, language)
  }
}
