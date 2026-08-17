import type { ConnectionSettings as IConnectionSettings } from 'abrechnung-common/types.js'
import test, { type ExecutionContext } from 'ava'
import axios from 'axios'
import { shutdown } from '../../app.js'
import { SECRET_PLACEHOLDER } from '../../controller/connectionSettingsController.js'
import ConnectionSettings from '../../models/connectionSettings.js'
import createAgent, { loginUser } from '../_agent.js'
import { withSettingsRestore } from '../_settings.js'

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
  assertSanitizedValue(t, data, existingSettings, ['llm', 'apiKey'])
})

test.serial('GET /admin/connectionSettings/form exposes LLM request controls', async (t) => {
  const res = await agent.get('/admin/connectionSettings/form')
  t.is(res.status, 200)

  const llmSchema = res.body.data.llm.schema
  t.like(llmSchema.timeoutSeconds, { type: 'text', inputType: 'number', default: 180 })
  t.like(llmSchema.maxTokens, { type: 'text', inputType: 'number' })
  t.true(llmSchema.maxTokens.rules.includes('integer'))
  t.true(llmSchema.maxTokens.rules.includes('min:1'))
  t.false(Object.hasOwn(llmSchema.maxTokens, 'default'))
  t.like(llmSchema.maxPromptOcrCharacters, { type: 'text', inputType: 'number', default: 40_000 })
  t.true(llmSchema.maxPromptOcrCharacters.rules.includes('integer'))
  t.true(llmSchema.maxPromptOcrCharacters.rules.includes('min:1'))
  t.true(llmSchema.maxPromptOcrCharacters.rules.includes('max:500000'))
  t.is(llmSchema.reasoningEffort.default, 'none')
  t.deepEqual(Object.keys(llmSchema.reasoningEffort.items), ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'])
})

test.serial('POST /admin/connectionSettings keeps original secrets when placeholder is sent', async (t) => {
  await withSettingsRestore(ConnectionSettings, {}, async (originalSettings) => {
    const expectedSettings = originalSettings as unknown as IConnectionSettings
    const originalAxiosGet = axios.get
    try {
      axios.get = (async () => ({ status: 200 })) as typeof axios.get
      const getRes = await agent.get('/admin/connectionSettings')
      t.is(getRes.status, 200)

      const postRes = await agent.post('/admin/connectionSettings').send(getRes.body.data)
      t.is(postRes.status, 200)

      const updatedSettings = await ConnectionSettings.findOne().lean()
      if (updatedSettings?.smtp?.auth.authType === 'Login' && expectedSettings.smtp?.auth.authType === 'Login') {
        t.is(updatedSettings?.smtp?.auth.pass, expectedSettings.smtp.auth.pass)
      } else if (updatedSettings?.smtp?.auth.authType === 'OAuth2' && expectedSettings.smtp?.auth.authType === 'OAuth2') {
        t.is(updatedSettings?.smtp?.auth.clientSecret, expectedSettings.smtp.auth.clientSecret)
      }
      t.is(updatedSettings?.auth?.ldapauth?.bindCredentials, expectedSettings.auth?.ldapauth?.bindCredentials)
      t.is(updatedSettings?.auth?.microsoft?.clientSecret, expectedSettings.auth?.microsoft?.clientSecret)
      t.is(updatedSettings?.auth?.oidc?.clientSecret, expectedSettings.auth?.oidc?.clientSecret)
      t.is(updatedSettings?.llm?.apiKey, expectedSettings.llm?.apiKey)

      assertSanitizedValue(t, postRes.body.result, originalSettings, ['smtp', 'auth', 'pass'])
      assertSanitizedValue(t, postRes.body.result, originalSettings, ['smtp', 'auth', 'clientSecret'])
      assertSanitizedValue(t, postRes.body.result, originalSettings, ['auth', 'ldapauth', 'bindCredentials'])
      assertSanitizedValue(t, postRes.body.result, originalSettings, ['auth', 'microsoft', 'clientSecret'])
      assertSanitizedValue(t, postRes.body.result, originalSettings, ['auth', 'oidc', 'clientSecret'])
      assertSanitizedValue(t, postRes.body.result, originalSettings, ['llm', 'apiKey'])
    } finally {
      axios.get = originalAxiosGet
    }
  })
})

test.serial('POST /admin/connectionSettings accepts new secret values', async (t) => {
  await withSettingsRestore(ConnectionSettings, {}, async () => {
    const originalAxiosGet = axios.get
    let requestedUrl = ''
    let requestedAuthorization = ''
    let requestedTimeout = 0

    try {
      axios.get = (async (url: string, config?: { headers?: { Authorization?: string }; timeout?: number }) => {
        requestedUrl = url
        requestedAuthorization = config?.headers?.Authorization ?? ''
        requestedTimeout = config?.timeout ?? 0
        return { status: 200 }
      }) as typeof axios.get
      const getRes = await agent.get('/admin/connectionSettings')
      t.is(getRes.status, 200)
      const settings: IConnectionSettings = getRes.body.data
      settings.auth.microsoft = { clientSecret: 'newSecretValue123', clientId: 'newClientId456', tenant: 'newTenant789' }
      if (!settings.llm) return t.fail('LLM connection settings missing')
      settings.llm.baseUrl = 'http://llm.test/v1/'
      settings.llm.apiKey = 'newLlmSecretValue123'
      settings.llm.maxTokens = 2_048
      settings.llm.maxPromptOcrCharacters = 12_345
      settings.llm.timeoutSeconds = 9

      const postRes = await agent.post('/admin/connectionSettings').send(settings)
      t.is(postRes.status, 200)

      const updatedSettings = await ConnectionSettings.findOne().lean()
      t.is(updatedSettings?.auth.microsoft?.clientSecret, settings.auth?.microsoft?.clientSecret)
      t.is(updatedSettings?.llm?.apiKey, settings.llm.apiKey)
      t.is(updatedSettings?.llm?.maxTokens, 2_048)
      t.is(updatedSettings?.llm?.maxPromptOcrCharacters, 12_345)
      t.is(postRes.body.result.auth.microsoft.clientSecret, SECRET_PLACEHOLDER)
      t.is(postRes.body.result.llm.apiKey, SECRET_PLACEHOLDER)
      t.is(requestedUrl, 'http://llm.test/v1/models')
      t.is(requestedAuthorization, 'Bearer newLlmSecretValue123')
      t.is(requestedTimeout, 9_000)
    } finally {
      axios.get = originalAxiosGet
    }
  })
})

test.serial('POST /admin/connectionSettings rejects unreachable LLM settings without saving them', async (t) => {
  await withSettingsRestore(ConnectionSettings, {}, async (originalSettings) => {
    const originalAxiosGet = axios.get
    try {
      const getRes = await agent.get('/admin/connectionSettings')
      t.is(getRes.status, 200)
      const settings: IConnectionSettings = getRes.body.data
      if (!settings.llm) return t.fail('LLM connection settings missing')
      settings.llm.baseUrl = 'http://unreachable-llm.test/v1'
      settings.llm.apiKey = 'rejectedLlmSecretValue123'
      axios.get = (async () => {
        throw new axios.AxiosError('connect ECONNREFUSED', 'ECONNREFUSED')
      }) as typeof axios.get

      const postRes = await agent.post('/admin/connectionSettings').send(settings)
      t.is(postRes.status, 500)
      t.is(postRes.body.message, 'LLM connection test failed.')
      t.false(JSON.stringify(postRes.body).includes('rejectedLlmSecretValue123'))

      const unchangedSettings = await ConnectionSettings.collection.findOne()
      t.deepEqual(unchangedSettings, originalSettings)
    } finally {
      axios.get = originalAxiosGet
    }
  })
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
