import { Body, Get, Post, Route, Security, Tags } from 'tsoa'
import { DisplaySettings as IDisplaySettings, locales } from '../../common/types.js'
import DisplaySettings, { displaySettingsSchema } from '../models/displaySettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, SetterBody } from './controller.js'

@Tags('Display Settings')
@Route('displaySettings')
export class DisplaySettingsController extends Controller {
  @Get()
  public async get() {
    return { data: (await DisplaySettings.findOne({}, { __v: 0 }).lean()) as IDisplaySettings }
  }
}

@Tags('Display Settings')
@Route('admin/displaySettings')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class DisplaySettingsAdminController extends Controller {
  @Post()
  public async post(@Body() requestBody: SetterBody<IDisplaySettings>) {
    return await this.setter(DisplaySettings, { requestBody: requestBody, allowNew: false })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(displaySettingsSchema.obj, locales) }
  }
}
