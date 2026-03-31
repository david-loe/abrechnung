import { locales } from 'abrechnung-common/types.js'
import { Body, Get, Path, Post, Route, Security, Tags } from 'tsoa'
import { reloadIntegrationSchedules } from '../integrations/scheduler.js'
import {
  getIntegrationScheduleSettingsFormSchema,
  getResolvedIntegrationSettings,
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
    return { data: await getResolvedIntegrationSettings(integrationKey) }
  }

  @Get('{integrationKey}/form/{scheduleKey}')
  public async getForm(@Path() integrationKey: string, @Path() scheduleKey: string) {
    return { data: getIntegrationScheduleSettingsFormSchema(integrationKey, scheduleKey, locales) }
  }

  @Post('{integrationKey}')
  public async post(@Path() integrationKey: string, @Body() requestBody: IntegrationSettingsPayload) {
    const result = await saveIntegrationSettings(integrationKey, { ...requestBody, integrationKey })
    await reloadIntegrationSchedules()
    return { message: 'alerts.successSaving', result }
  }
}
