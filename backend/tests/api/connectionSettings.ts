import { ConnectionSettings as IConnectionSettings } from 'abrechnung-common/types.js'
import test, { ExecutionContext } from 'ava'
import { shutdown } from '../../app.js'
import { SECRET_PLACEHOLDER } from '../../controller/connectionSettingsController.js'
import ConnectionSettings from '../../models/connectionSettings.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'admin')

function getFromPath(object: unknown, path: string[]) {
  return path.reduce<unknown>((value, key) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return (value as Record<string, unknown>)[key]
    }
    return undefined
  }, object)
}

function assertSanitizedValue(t: ExecutionContext, data: unknown, original: unknown, path: string[]) {
  const sanitizedValue = getFromPath(data, path)
  const originalValue = getFromPath(original, path)

  if (originalValue !== undefined) {
    t.is(sanitizedValue, SECRET_PLACEHOLDER)
    t.not(sanitizedValue, originalValue)
  } else {
    t.is(sanitizedValue, undefined)
  }
}

test.serial('GET /admin/connectionSettings hides secrets', async (t) => {
  const existingSettings = await ConnectionSettings.findOne().lean()
  const res = await agent.get('/admin/connectionSettings')
  t.is(res.status, 200)
  const data = res.body.data

  assertSanitizedValue(t, data, existingSettings, ['smtp', 'auth', 'pass'])
  assertSanitizedValue(t, data, existingSettings, ['auth', 'ldapauth', 'bindCredentials'])
  assertSanitizedValue(t, data, existingSettings, ['auth', 'microsoft', 'clientSecret'])
  assertSanitizedValue(t, data, existingSettings, ['auth', 'oidc', 'clientSecret'])
})

test.serial('POST /admin/connectionSettings keeps original secrets when placeholder is sent', async (t) => {
  const originalSettings = await ConnectionSettings.findOne().lean()
  const getRes = await agent.get('/admin/connectionSettings')
  t.is(getRes.status, 200)

  const postRes = await agent.post('/admin/connectionSettings').send(getRes.body.data)
  t.is(postRes.status, 200)

  const updatedSettings = await ConnectionSettings.findOne().lean()
  if (updatedSettings?.smtp?.auth.authType === 'Login' && originalSettings?.smtp?.auth.authType === 'Login') {
    t.is(updatedSettings?.smtp?.auth.pass, originalSettings?.smtp?.auth.pass)
  } else if (updatedSettings?.smtp?.auth.authType === 'OAuth2' && originalSettings?.smtp?.auth.authType === 'OAuth2') {
    t.is(updatedSettings?.smtp?.auth.clientSecret, originalSettings?.smtp?.auth.clientSecret)
  }
  t.is(updatedSettings?.auth?.ldapauth?.bindCredentials, originalSettings?.auth?.ldapauth?.bindCredentials)
  t.is(updatedSettings?.auth?.microsoft?.clientSecret, originalSettings?.auth?.microsoft?.clientSecret)
  t.is(updatedSettings?.auth?.oidc?.clientSecret, originalSettings?.auth?.oidc?.clientSecret)

  assertSanitizedValue(t, postRes.body.result, originalSettings, ['smtp', 'auth', 'pass'])
  assertSanitizedValue(t, postRes.body.result, originalSettings, ['smtp', 'auth', 'clientSecret'])
  assertSanitizedValue(t, postRes.body.result, originalSettings, ['auth', 'ldapauth', 'bindCredentials'])
  assertSanitizedValue(t, postRes.body.result, originalSettings, ['auth', 'microsoft', 'clientSecret'])
  assertSanitizedValue(t, postRes.body.result, originalSettings, ['auth', 'oidc', 'clientSecret'])
})

test.serial('POST /admin/connectionSettings accepts new secret values', async (t) => {
  const getRes = await agent.get('/admin/connectionSettings')
  t.is(getRes.status, 200)
  const settings: IConnectionSettings = getRes.body.data
  settings.auth.microsoft = { clientSecret: 'newSecretValue123', clientId: 'newClientId456', tenant: 'newTenant789' }

  const postRes = await agent.post('/admin/connectionSettings').send(settings)
  t.is(postRes.status, 200)

  const updatedSettings = await ConnectionSettings.findOne().lean()
  t.is(updatedSettings?.auth.microsoft?.clientSecret, settings.auth?.microsoft?.clientSecret)
  t.is(postRes.body.result.auth.microsoft.clientSecret, SECRET_PLACEHOLDER)
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
