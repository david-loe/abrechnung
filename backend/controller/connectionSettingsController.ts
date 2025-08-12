import { ConnectionSettings as IConnectionSettings, locales } from 'abrechnung-common/types.js'
import { Body, Get, Post, Route, Security, Tags } from 'tsoa'
import ConnectionSettings, { connectionSettingsSchema } from '../models/connectionSettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller } from './controller.js'

@Tags('Connection Settings')
@Route('admin/connectionSettings')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class ConnectionSettingsController extends Controller {
  @Get()
  public async get() {
    return { data: (await ConnectionSettings.findOne({}, { __v: 0 }).lean()) as IConnectionSettings }
  }
  @Post()
  public async post(@Body() requestBody: IConnectionSettings) {
    return await this.setter(ConnectionSettings, { requestBody: requestBody, allowNew: false })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(connectionSettingsSchema().obj, locales) }
  }
}
