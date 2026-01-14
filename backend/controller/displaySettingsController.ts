import { ConnectionSettings as IConnectionSettings, DisplaySettings as IDisplaySettings, locales } from 'abrechnung-common/types.js'
import { Types } from 'mongoose'
import { Body, Get, Post, Route, Security, Tags } from 'tsoa'
import ConnectionSettings from '../models/connectionSettings.js'
import DisplaySettings, { displaySettingsSchema } from '../models/displaySettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, SetterBody } from './controller.js'

@Tags('Display Settings')
@Route('displaySettings')
export class DisplaySettingsController extends Controller {
  @Get()
  public async get() {
    const displaySettings = (await DisplaySettings.findOne({}, { __v: 0 }).lean()) as IDisplaySettings | null
    const connectionSettings = (await ConnectionSettings.findOne({}, { __v: 0 }).lean()) as IConnectionSettings | null
    if (displaySettings && connectionSettings) {
      displaySettings.auth = {
        microsoft: displaySettings.auth.microsoft && Boolean(connectionSettings.auth.microsoft),
        magiclogin: displaySettings.auth.magiclogin && Boolean(connectionSettings.smtp),
        ldapauth: displaySettings.auth.ldapauth && Boolean(connectionSettings.auth.ldapauth),
        oidc: displaySettings.auth.oidc && Boolean(connectionSettings.auth.oidc)
      }
    }

    return { data: displaySettings }
  }
}

@Tags('Display Settings')
@Route('admin/displaySettings')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class DisplaySettingsAdminController extends Controller {
  @Post()
  public async post(@Body() requestBody: SetterBody<IDisplaySettings<Types.ObjectId>>) {
    return await this.setter(DisplaySettings, { requestBody: requestBody, allowNew: false })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(displaySettingsSchema().obj, locales) }
  }
}
