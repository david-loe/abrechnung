import { Body, Get, Post, Route, Security, Tags } from 'tsoa'
import { PrinterSettings as IPrinterSettings, locales } from '../../common/types.js'
import PrinterSettings, { printerSettingsSchema } from '../models/printerSettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, SetterBody } from './controller.js'

@Tags('Printer Settings')
@Route('admin/printerSettings')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class PrinterSettingsController extends Controller {
  @Get()
  public async get() {
    return { data: (await PrinterSettings.findOne({}, { __v: 0 }).lean()) as IPrinterSettings }
  }
  @Post()
  public async post(@Body() requestBody: SetterBody<IPrinterSettings>) {
    return await this.setter(PrinterSettings, { requestBody: requestBody, allowNew: false })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(printerSettingsSchema.obj, locales) }
  }
}
