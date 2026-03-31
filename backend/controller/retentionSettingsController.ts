import { RetentionSettings as IRetentionSettings, locales } from 'abrechnung-common/types.js'
import { Body, Get, Post, Route, Security, Tags } from 'tsoa'
import { reloadIntegrationSchedules } from '../integrations/scheduler.js'
import { getResolvedRetentionSettings, getRetentionSettingsFormSchema, saveRetentionSettings } from '../models/retentionSettings.js'
import { Controller } from './controller.js'

@Tags('Retention Settings')
@Route('admin/retentionSettings')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class RetentionSettingsAdminController extends Controller {
  @Get()
  public async get() {
    return { data: await getResolvedRetentionSettings() }
  }

  @Get('form')
  public async getForm() {
    return { data: getRetentionSettingsFormSchema(locales) }
  }

  @Post()
  public async post(@Body() requestBody: IRetentionSettings<string>) {
    const result = await saveRetentionSettings({
      enabled: requestBody.enabled,
      schedule: requestBody.schedule,
      retentionPolicy: requestBody.retentionPolicy
    })
    await reloadIntegrationSchedules()
    return { message: 'alerts.successSaving', result }
  }
}
