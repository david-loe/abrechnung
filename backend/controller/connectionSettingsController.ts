import { ConnectionSettings as IConnectionSettings, locales } from 'abrechnung-common/types.js'
import { Body, Get, Post, Route, Security, Tags } from 'tsoa'
import ConnectionSettings, { connectionSettingsSchema } from '../models/connectionSettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller } from './controller.js'

export const SECRET_PLACEHOLDER = '********'
const SECRET_PATHS = ['smtp.password', 'auth.microsoft.clientSecret', 'auth.ldapauth.bindCredentials', 'auth.oidc.clientSecret']

function cloneSettings<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function getFromPath(object: unknown, path: string[]) {
  return path.reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return (value as Record<string, unknown>)[key]
    }
    return undefined
  }, object)
}

function setIfPresent(object: unknown, path: string[], value: unknown) {
  if (!object || typeof object !== 'object') return
  let current: Record<string, unknown> | undefined = object as Record<string, unknown>
  for (const key of path.slice(0, -1)) {
    const next = current?.[key]
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      return
    }
    current = next as Record<string, unknown>
  }
  const lastKey = path.at(-1)
  if (lastKey && Object.hasOwn(current, lastKey)) {
    current[lastKey] = value as never
  }
}

function ensurePath(object: unknown, path: string[]) {
  if (!object || typeof object !== 'object') return undefined
  let current: Record<string, unknown> = object as Record<string, unknown>
  for (const key of path.slice(0, -1)) {
    if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  return current
}

function sanitizeConnectionSettings(connectionSettings?: IConnectionSettings | null) {
  if (!connectionSettings) return connectionSettings
  const sanitized = cloneSettings(connectionSettings)

  for (const path of SECRET_PATHS) {
    setIfPresent(sanitized, path.split('.'), SECRET_PLACEHOLDER)
  }

  return sanitized
}

function keepOriginalSecrets(updatedSettings: IConnectionSettings, existingSettings?: IConnectionSettings | null): IConnectionSettings {
  if (!existingSettings) return updatedSettings

  const mergedSettings = cloneSettings(updatedSettings)

  for (const path of SECRET_PATHS) {
    const pathArray = path.split('.')
    if (getFromPath(mergedSettings, pathArray) === SECRET_PLACEHOLDER) {
      const originalValue = getFromPath(existingSettings, pathArray)
      if (originalValue !== undefined) {
        const parent = ensurePath(mergedSettings, pathArray)
        const lastKey = pathArray.at(-1)
        if (parent && lastKey) parent[lastKey] = originalValue as never
      }
    }
  }

  return mergedSettings
}

@Tags('Connection Settings')
@Route('admin/connectionSettings')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class ConnectionSettingsController extends Controller {
  @Get()
  public async get() {
    const connectionSettings = (await ConnectionSettings.findOne({}, { __v: 0 }).lean()) as IConnectionSettings | null

    return { data: sanitizeConnectionSettings(connectionSettings) as IConnectionSettings }
  }
  @Post()
  public async post(@Body() requestBody: IConnectionSettings) {
    const existingSettings = (await ConnectionSettings.findOne({}, { __v: 0 }).lean()) as IConnectionSettings | null
    const mergedRequest = keepOriginalSecrets(requestBody, existingSettings)
    const result = await this.setter(ConnectionSettings, { requestBody: mergedRequest, allowNew: false })

    return { ...result, result: sanitizeConnectionSettings(result.result as IConnectionSettings) }
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(connectionSettingsSchema().obj, locales) }
  }
}
