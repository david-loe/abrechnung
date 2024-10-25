import { Body, Get, Post, Route, Security } from 'tsoa'
import { ConnectionSettings as IConnectionSettings, locales } from '../../common/types.js'
import ConnectionSettings, { connectionSettingsSchema } from '../models/connectionSettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, SetterBody } from './controller.js'

@Route('admin/connectionSettings')
@Security('cookieAuth', ['admin'])
export class ConnectionSettingsController extends Controller {
  @Get()
  public async getConnectionSettings() {
    return { data: (await ConnectionSettings.findOne({}, { __v: 0 }).lean()) as IConnectionSettings }
  }
  @Post()
  public async postConnectionSettings(@Body() requestBody: SetterBody<IConnectionSettings>) {
    return await this.setter(ConnectionSettings, { requestBody: requestBody, allowNew: false })
  }
  @Get('form')
  public async getConnectionSettingsForm() {
    return { data: mongooseSchemaToVueformSchema(connectionSettingsSchema.obj, locales) }
  }
}
