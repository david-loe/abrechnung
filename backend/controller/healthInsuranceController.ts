import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from 'tsoa'
import { _id, HealthInsurance as IHealthInsurance, locales } from '../../common/types.js'
import HealthInsurance, { healthInsuranceSchema } from '../models/healthInsurance.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Tags('Heath Insurance')
@Route('healthInsurance')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class HealthInsuranceController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<IHealthInsurance>) {
    return await this.getter(HealthInsurance, { query })
  }
}

@Tags('Heath Insurance')
@Route('admin/healthInsurance')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class HealthInsuranceAdminController extends Controller {
  @Post()
  public async post(@Body() requestBody: SetterBody<IHealthInsurance>) {
    return await this.setter(HealthInsurance, { requestBody: requestBody, allowNew: true })
  }
  @Post('bulk')
  public async postMany(@Body() requestBody: SetterBody<IHealthInsurance>[]) {
    return await this.insertMany(HealthInsurance, { requestBody })
  }
  @Delete()
  public async delete(@Query() _id: _id) {
    return await this.deleter(HealthInsurance, { _id: _id })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(healthInsuranceSchema().obj, locales) }
  }
}
