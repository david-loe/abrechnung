import { Body, Get, Post, Route, Security } from 'tsoa'
import { SystemSettings as ISystemSettings, locales } from '../../common/types.js'
import SystemSettings, { systemSettingsSchema } from '../models/systemSettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, SetterBody } from './controller.js'

@Route('admin/systemSettings')
@Security('cookieAuth', ['admin'])
export class SystemSettingsController extends Controller {
  @Get()
  public async getSystemSettings() {
    return { data: (await SystemSettings.findOne({}, { __v: 0 }).lean()) as ISystemSettings }
  }
  @Post()
  public async postSystemSettings(@Body() requestBody: SetterBody<ISystemSettings>) {
    return await this.setter(SystemSettings, { requestBody: requestBody, allowNew: false })
  }
  @Get('form')
  public async getSystemSettingsForm() {
    return { data: mongooseSchemaToVueformSchema(systemSettingsSchema.obj, locales) }
  }
}
