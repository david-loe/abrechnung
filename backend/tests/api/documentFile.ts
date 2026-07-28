import { ReceiptSuggestion } from 'abrechnung-common/types.js'
import test from 'ava'
import axios from 'axios'
import { shutdown } from '../../app.js'
import { logger } from '../../logger.js'
import ConnectionSettings from '../../models/connectionSettings.js'
import DocumentFile from '../../models/documentFile.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

let documentFileId = ''
let projectId = ''

test.serial('POST /documentFile creates a temporary receipt', async (t) => {
  const projectResponse = await agent.get('/project')
  projectId = projectResponse.body.data[0]._id

  const response = await agent
    .post('/documentFile')
    .attach('file', 'tests/files/dummy.pdf', { filename: 'invoice.pdf', contentType: 'application/pdf' })

  t.is(response.status, 201)
  t.like(response.body.result, { name: 'invoice.pdf', type: 'application/pdf' })
  t.false(Object.hasOwn(response.body.result, 'data'))
  documentFileId = response.body.result._id

  const storedDocument = await DocumentFile.findById(documentFileId).select('+expiresAt').lean()
  t.truthy(storedDocument?.expiresAt)
})

test.serial('POST /documentFile/ocr stores OCR only for the owner', async (t) => {
  await loginUser(agent, 'travel')
  const forbidden = await agent.post('/documentFile/ocr').send({ documentFileId, ocr: 'foreign receipt' })
  t.is(forbidden.status, 403)

  await loginUser(agent, 'user')
  const response = await agent.post('/documentFile/ocr').send({ documentFileId, ocr: 'Invoice date 2026-07-24, total 10.70 EUR' })
  t.is(response.status, 204)

  const storedDocument = await DocumentFile.findById(documentFileId).select('+ocr').lean()
  t.is(storedDocument?.ocr, 'Invoice date 2026-07-24, total 10.70 EUR')
})

test.serial('GET /suggestions returns validated OpenAI-compatible JSON', async (t) => {
  const settings = await ConnectionSettings.findOne()
  if (!settings) return t.fail('Connection settings missing')
  const originalLlm = settings.toObject().llm
  settings.llm = { baseUrl: 'http://llm.test/v1', model: 'test-model', apiKey: 'secret', reasoningEffort: 'low', timeoutSeconds: 12 }
  await settings.save()

  const originalPost = axios.post
  let requestedUrl = ''
  let requestedBody: unknown
  let requestedAuthorization = ''
  let requestedTimeout = 0
  axios.post = (async (url: string, body: unknown, config: { headers?: { Authorization?: string }; timeout?: number }) => {
    requestedUrl = url
    requestedBody = body
    requestedAuthorization = config.headers?.Authorization ?? ''
    requestedTimeout = config.timeout ?? 0
    const suggestion: ReceiptSuggestion = {
      type: 'expense',
      description: 'Lunch',
      cost: { date: '2026-07-24', currencyCode: 'EUR', positions: [{ description: 'Meal', grossAmount: 10.7, vatRate: 7 }] }
    }
    return { data: { choices: [{ message: { content: JSON.stringify(suggestion) } }] } }
  }) as typeof axios.post

  try {
    const response = await agent
      .get('/suggestions')
      .query({ type: 'expense', reportType: 'Travel', projectId, documentFileIds: documentFileId })

    t.is(response.status, 200)
    t.is(response.headers['cache-control'], 'no-store')
    t.deepEqual(response.body.data, {
      type: 'expense',
      description: 'Lunch',
      cost: { date: '2026-07-24', currencyCode: 'EUR', positions: [{ description: 'Meal', grossAmount: 10.7, vatRate: 7 }] }
    })
    t.is(requestedUrl, 'http://llm.test/v1/chat/completions')
    t.is(requestedAuthorization, 'Bearer secret')
    t.is(requestedTimeout, 12_000)
    t.like(requestedBody as object, { model: 'test-model', temperature: 0, max_tokens: 512, reasoning_effort: 'low' })
    t.like((requestedBody as { response_format: object }).response_format, {
      type: 'json_schema',
      json_schema: { name: 'receipt_suggestion', strict: true }
    })
  } finally {
    axios.post = originalPost
    settings.llm = originalLlm
    await settings.save()
  }
})

test.serial('GET /suggestions returns 502 and logs actionable connection details for LLM failures', async (t) => {
  const settings = await ConnectionSettings.findOne()
  if (!settings) return t.fail('Connection settings missing')
  const originalLlm = settings.toObject().llm
  settings.llm = { baseUrl: 'http://llm.test/v1', model: 'test-model', apiKey: 'secret', reasoningEffort: null, timeoutSeconds: 7 }
  await settings.save()
  const originalPost = axios.post
  const originalLoggerError = logger.error
  let loggedDetails: unknown
  let requestedBody: unknown
  let requestedTimeout = 0
  axios.post = (async (_url: string, body: unknown, config: { timeout?: number }) => {
    requestedBody = body
    requestedTimeout = config.timeout ?? 0
    throw new axios.AxiosError('connect ECONNREFUSED', 'ECONNREFUSED')
  }) as typeof axios.post
  logger.error = ((message: unknown, details: unknown) => {
    if (message === 'LLM suggestion request failed.') loggedDetails = details
  }) as typeof logger.error

  try {
    const response = await agent
      .get('/suggestions')
      .query({ type: 'expense', reportType: 'Travel', projectId, documentFileIds: documentFileId })

    t.is(response.status, 502)
    t.is(response.body.name, 'alerts.upstreamServiceError')
    t.like(loggedDetails as object, { endpoint: 'http://llm.test/v1/chat/completions', model: 'test-model', code: 'ECONNREFUSED' })
    t.is(requestedTimeout, 7_000)
    t.false(Object.hasOwn(requestedBody as object, 'reasoning_effort'))
  } finally {
    axios.post = originalPost
    logger.error = originalLoggerError
    settings.llm = originalLlm
    await settings.save()
  }
})

test.serial('GET /suggestions returns no content without LLM settings', async (t) => {
  const settings = await ConnectionSettings.findOne()
  if (!settings) return t.fail('Connection settings missing')
  const originalLlm = settings.toObject().llm
  settings.llm = null
  await settings.save()

  try {
    const response = await agent
      .get('/suggestions')
      .query({ type: 'expense', reportType: 'Travel', projectId, documentFileIds: documentFileId })
    t.is(response.status, 204)
  } finally {
    settings.llm = originalLlm
    await settings.save()
  }
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
