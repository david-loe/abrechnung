import { Body, Delete, Get, Post, Queries, Query, Route, Security } from 'tsoa'
import { HealthInsurance as IHealthInsurance, _id, locales } from '../../common/types.js'
import HealthInsurance, { healthInsuranceSchema } from '../models/healthInsurance.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Route('healthInsurance')
@Security('cookieAuth', ['user'])
export class HealthInsuranceController extends Controller {
  @Get()
  public async getHealthInsurance(@Queries() query: GetterQuery<IHealthInsurance>) {
    return await this.getter(HealthInsurance, { query })
  }
}

@Route('admin/healthInsurance')
@Security('cookieAuth', ['admin'])
export class HealthInsuranceAdminController extends Controller {
  @Post()
  public async postHealthInsurance(@Body() requestBody: SetterBody<IHealthInsurance>) {
    return await this.setter(HealthInsurance, { requestBody: requestBody, allowNew: true })
  }
  @Post('bulk')
  public async postManyProjects(@Body() requestBody: SetterBody<IHealthInsurance>[]) {
    return await this.insertMany(HealthInsurance, { requestBody })
  }
  @Delete()
  public async deleteHealthInsurance(@Query() _id: _id) {
    return await this.deleter(HealthInsurance, { _id: _id })
  }
  @Get('form')
  public async getHealthInsuranceForm() {
    return { data: mongooseSchemaToVueformSchema(healthInsuranceSchema.obj, locales) }
  }
}
