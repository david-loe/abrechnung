import { Route, Get, Tags, Security, Queries, Post, Body } from 'tsoa'
import { Controller, SetterBody } from './controller.js'
import Settings from '../models/settings.js'
import { Settings as ISettings } from '../../common/types.js'

@Tags('Settings')
@Route('api/settings')
@Security('cookieAuth', ['user'])
export class SettingsController extends Controller {
  @Get()
  public async getSettings() {
    return { data: (await Settings.findOne({}, { __v: 0 })) as ISettings }
  }
}

@Tags('Admin', 'Settings')
@Route('api/admin/settings')
@Security('cookieAuth', ['admin'])
export class SettingsAdminController extends Controller {
  @Post()
  public async postUser(@Body() requestBody: SetterBody<ISettings>) {
    return await this.setter(Settings, { requestBody: requestBody, allowNew: false })
  }
}
