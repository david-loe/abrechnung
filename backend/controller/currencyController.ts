import { Route, Get, Tags, Security, Queries, Post, Body, Delete, Query } from 'tsoa'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import Currency from '../models/currency.js'
import { Currency as ICurrency, _id } from '../../common/types.js'

@Tags('Currency')
@Route('api/currency')
@Security('cookieAuth', ['user'])
export class CurrencyController extends Controller {
  @Get()
  public async getCurrency(@Queries() query: GetterQuery<ICurrency>) {
    return await this.getter(Currency, { query })
  }
}

@Tags('Admin', 'Currency')
@Route('api/admin/currency')
@Security('cookieAuth', ['admin'])
export class CurrencyAdminController extends Controller {
  @Post()
  public async postCurrency(@Body() requestBody: SetterBody<ICurrency>) {
    return await this.setter(Currency, { requestBody: requestBody })
  }
  @Delete()
  public async deleteCurrency(@Query() _id: _id) {
    return await this.deleter(Currency, { _id: _id })
  }
}
