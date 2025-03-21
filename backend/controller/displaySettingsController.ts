import { Body, Get, Post, Route, Security } from 'tsoa'
import { DisplaySettings as IDisplaySettings, locales } from '../../common/types.js'
import DisplaySettings, { displaySettingsSchema } from '../models/displaySettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, SetterBody } from './controller.js'

@Route('displaySettings')
export class DisplaySettingsController extends Controller {
  @Get()
  public async getDisplaySettings() {
    return { data: (await DisplaySettings.findOne({}, { __v: 0 }).lean()) as IDisplaySettings }
  }
}

@Route('admin/displaySettings')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class DisplaySettingsAdminController extends Controller {
  @Post()
  public async postDisplaySettings(@Body() requestBody: SetterBody<IDisplaySettings>) {
    return await this.setter(DisplaySettings, { requestBody: requestBody, allowNew: false })
  }
  @Get('form')
  public async getDisplaySettingsForm() {
    return { data: mongooseSchemaToVueformSchema(displaySettingsSchema.obj, locales) }
  }
}
