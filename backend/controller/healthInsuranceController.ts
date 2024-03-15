import { Route, Get, Tags, Security, Queries, Post, Body, Delete, Query } from 'tsoa'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import HealthInsurance from '../models/healthInsurance.js'
import { HealthInsurance as IHealthInsurance, _id } from '../../common/types.js'

@Tags('HealthInsurance')
@Route('healthInsurance')
@Security('cookieAuth', ['user'])
export class HealthInsuranceController extends Controller {
  @Get()
  public async getHealthInsurance(@Queries() query: GetterQuery<IHealthInsurance>) {
    return await this.getter(HealthInsurance, { query })
  }
}

@Tags('Admin', 'HealthInsurance')
@Route('admin/healthInsurance')
@Security('cookieAuth', ['admin'])
export class HealthInsuranceAdminController extends Controller {
  @Post()
  public async postHealthInsurance(@Body() requestBody: SetterBody<IHealthInsurance>) {
    return await this.setter(HealthInsurance, { requestBody: requestBody })
  }
  @Delete()
  public async deleteHealthInsurance(@Query() _id: _id) {
    return await this.deleter(HealthInsurance, { _id: _id })
  }
}
