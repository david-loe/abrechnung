import { Body, Get, Post, Query, Route, Security, Tags } from 'tsoa'
import { Settings as ISettings, Locale } from '../../common/types.js'
import { mongooseSchemaToVueformSchema } from '../helper.js'
import Settings, { settingsSchema } from '../models/settings.js'
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
  @Get('schema')
  public async getSchema(@Query() language: Locale) {
    return mongooseSchemaToVueformSchema(settingsSchema.obj, language)
  }
}
