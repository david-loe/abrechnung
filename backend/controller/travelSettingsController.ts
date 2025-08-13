import { TravelSettings as ITravelSettings, locales } from 'abrechnung-common/types.js'
import { Types } from 'mongoose'
import { Body, Get, Post, Route, Security, Tags } from 'tsoa'
import TravelSettings, { travelSettingsSchema } from '../models/travelSettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, SetterBody } from './controller.js'

@Tags('Travel Settings')
@Route('travelSettings')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class TravelSettingsController extends Controller {
  @Get()
  public async get() {
    return { data: (await TravelSettings.findOne({}, { __v: 0 }).lean()) as ITravelSettings }
  }
}

@Tags('Travel Settings')
@Route('admin/travelSettings')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class TravelSettingsAdminController extends Controller {
  @Post()
  public async post(@Body() requestBody: SetterBody<ITravelSettings<Types.ObjectId>>) {
    return await this.setter(TravelSettings, { requestBody: requestBody, allowNew: false })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(travelSettingsSchema().obj, locales) }
  }
}
