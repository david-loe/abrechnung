import { Settings as ISettings, locales } from 'abrechnung-common/types.js'
import { Types } from 'mongoose'
import { Body, Get, Post, Route, Security, Tags } from 'tsoa'
import Settings, { settingsSchema } from '../models/settings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, SetterBody } from './controller.js'

@Tags('Settings')
@Route('settings')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class SettingsController extends Controller {
  @Get()
  public async get() {
    return { data: (await Settings.findOne({}, { __v: 0 }).lean()) as ISettings }
  }
}

@Tags('Settings')
@Route('admin/settings')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class SettingsAdminController extends Controller {
  @Post()
  public async post(@Body() requestBody: SetterBody<Omit<ISettings<Types.ObjectId>, 'version' | 'migrateFrom'>>) {
    return await this.setter(Settings, { requestBody: requestBody, allowNew: false })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(settingsSchema().obj, locales) }
  }
}
