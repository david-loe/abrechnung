import { Webhook as IWebhook, locales } from 'abrechnung-common/types.js'
import { Types } from 'mongoose'
import { Body, Delete, Get, Post, Queries, Query, Route, Security, Tags } from 'tsoa'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import Webhook, { webhookSchema } from '../models/webhook.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'

@Tags('Webhook')
@Route('admin/webhook')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class WebhookAdminController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<unknown>) {
    return await this.getter(Webhook, { query })
  }
  @Post()
  public async post(@Body() requestBody: SetterBody<IWebhook<Types.ObjectId>>) {
    return await this.setter(Webhook, { requestBody: requestBody, allowNew: true })
  }
  @Delete()
  public async delete(@Query() _id: string) {
    return await this.deleter(Webhook, { _id })
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(webhookSchema().obj, locales) }
  }
}
