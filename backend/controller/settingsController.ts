import { Body, Get, Post, Route, Security, Tags } from 'tsoa'
import { Settings as ISettings, locales } from '../../common/types.js'
import Settings, { settingsSchema } from '../models/settings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, SetterBody } from './controller.js'

@Tags('Settings')
@Route('settings')
@Security('cookieAuth', ['user'])
export class SettingsController extends Controller {
  @Get()
  public async getSettings() {
    return { data: (await Settings.findOne({}, { __v: 0 }).lean()) as ISettings }
  }
}

@Tags('Admin', 'Settings')
@Route('admin/settings')
@Security('cookieAuth', ['admin'])
export class SettingsAdminController extends Controller {
  @Post()
  public async postUser(@Body() requestBody: SetterBody<ISettings>) {
    return await this.setter(Settings, { requestBody: requestBody, allowNew: false })
  }
  @Get('form')
  public async getSettingsForm() {
    return { data: mongooseSchemaToVueformSchema(settingsSchema.obj, locales) }
  }
}
