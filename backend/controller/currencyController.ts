import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from 'tsoa'
import { Currency as ICurrency, _id } from '../../common/types.js'
import Currency from '../models/currency.js'
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
  @Post('bulk')
  public async postManyProjects(@Body() requestBody: SetterBody<ICurrency>[]) {
    return await this.insertMany(Currency, { requestBody })
  }
  @Delete()
  public async deleteCurrency(@Query() _id: _id) {
    return await this.deleter(Currency, { _id: _id })
  }
}
