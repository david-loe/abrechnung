import { locales } from 'abrechnung-common/types.js'
import { Body, Get, Path, Post, Route, Security, Tags } from 'tsoa'
import { syncIntegrationSchedules } from '../integrations/scheduler.js'
import {
  getIntegrationSettings,
  getIntegrationSettingsFormSchema,
  type IntegrationSettingsPayload,
  saveIntegrationSettings
} from '../integrations/settings.js'
import { Controller } from './controller.js'

@Tags('Integration Settings')
@Route('admin/integrationSettings')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class IntegrationSettingsController extends Controller {
  @Get('{integrationKey}')
  public async get(@Path() integrationKey: string) {
    return { data: await getIntegrationSettings(integrationKey) }
  }

  @Get('{integrationKey}/form')
  public async getIntegrationForm(@Path() integrationKey: string) {
    return { data: await getIntegrationSettingsFormSchema(integrationKey, locales) }
  }

  @Post('{integrationKey}')
  public async post(@Path() integrationKey: string, @Body() requestBody: IntegrationSettingsPayload) {
    const result = await saveIntegrationSettings(integrationKey, { ...requestBody, integrationKey })
    await syncIntegrationSchedules()
    return { message: 'alerts.successSaving', result }
  }
}
