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
let reportId = ''
let reportOwnerId = ''

interface RequestedSuggestionBody {
  model: string
  temperature: number
  max_tokens?: number
  reasoning_effort?: string
  messages: { role: string; content: string }[]
  response_format: {
    type: string
    json_schema: {
      name: string
      strict: boolean
      schema: {
        properties: {
          cost: { properties: { currencyCode: { pattern?: string; enum?: unknown[] }; positions: Record<string, unknown> } }
          startLocation: { properties: { countryCode: { pattern?: string; enum?: unknown[] } } }
        }
      }
    }
  }
}

test.serial('POST /documentFile creates a temporary receipt', async (t) => {
  const projectResponse = await agent.get('/project')
  projectId = projectResponse.body.data[0]._id
  const reportResponse = await agent.post('/expenseReport/inWork').send({ name: 'Receipt suggestion context', project: projectId })
  t.is(reportResponse.status, 200)
  reportId = reportResponse.body.result._id

  const response = await agent
    .post('/documentFile')
    .attach('file', 'tests/files/dummy.pdf', { filename: 'invoice.pdf', contentType: 'application/pdf' })

  t.is(response.status, 201)
  t.like(response.body.result, { name: 'invoice.pdf', type: 'application/pdf' })
  t.false(Object.hasOwn(response.body.result, 'data'))
  documentFileId = response.body.result._id
  reportOwnerId = response.body.result.owner._id ?? response.body.result.owner

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

test.serial('Examiner document endpoints require and enforce the report context', async (t) => {
  await loginUser(agent, 'travel')
  const foreignUpload = await agent
    .post('/documentFile')
    .attach('file', 'tests/files/dummy.pdf', { filename: 'foreign.pdf', contentType: 'application/pdf' })
  t.is(foreignUpload.status, 201)
  const foreignDocumentFileId = foreignUpload.body.result._id as string

  try {
    await loginUser(agent, 'expenseReport')
    const missingContext = await agent.post('/examine/documentFile/ocr').send({ documentFileId, ocr: 'missing context' })
    t.is(missingContext.status, 422)

    const wrongReportType = await agent
      .post('/examine/documentFile/ocr')
      .send({ documentFileId, ocr: 'wrong report', reportId, sourceReportType: 'Travel' })
    t.is(wrongReportType.status, 403)

    const foreignDocument = await agent
      .post('/examine/documentFile/ocr')
      .send({ documentFileId: foreignDocumentFileId, ocr: 'foreign receipt', reportId, sourceReportType: 'ExpenseReport' })
    t.is(foreignDocument.status, 403)

    const ocrResponse = await agent
      .post('/examine/documentFile/ocr')
      .send({ documentFileId, ocr: 'examiner OCR', reportId, sourceReportType: 'ExpenseReport' })
    t.is(ocrResponse.status, 204)

    const missingGetContext = await agent.get('/examine/documentFile').query({ _id: documentFileId })
    t.is(missingGetContext.status, 422)
    const getResponse = await agent.get('/examine/documentFile').query({ _id: documentFileId, reportId, sourceReportType: 'ExpenseReport' })
    t.is(getResponse.status, 200)
    t.is(getResponse.headers['content-type'], 'application/pdf')

    const examinedUpload = await agent
      .post('/examine/documentFile')
      .query({ ownerId: documentFileId, reportId, sourceReportType: 'ExpenseReport' })
      .attach('file', 'tests/files/dummy.pdf', { filename: 'examined.pdf', contentType: 'application/pdf' })
    t.is(examinedUpload.status, 403)

    const authorizedUpload = await agent
      .post('/examine/documentFile')
      .query({ ownerId: reportOwnerId, reportId, sourceReportType: 'ExpenseReport' })
      .attach('file', 'tests/files/dummy.pdf', { filename: 'examined.pdf', contentType: 'application/pdf' })
    t.is(authorizedUpload.status, 201)

    const deleteResponse = await agent
      .delete('/examine/documentFile')
      .query({ _id: authorizedUpload.body.result._id, reportId, sourceReportType: 'ExpenseReport' })
    t.is(deleteResponse.status, 200)
  } finally {
    await loginUser(agent, 'travel')
    const cleanup = await agent.delete('/documentFile').query({ _id: foreignDocumentFileId })
    t.is(cleanup.status, 200)
    await loginUser(agent, 'user')
  }
})

test.serial('Examiner suggestion endpoint enforces the report context before calling the LLM', async (t) => {
  try {
    await loginUser(agent, 'expenseReport')
    const missingContext = await agent
      .post('/examine/suggestions')
      .send({ type: 'expense', reportType: 'ExpenseReport', projectId, documentFileIds: [documentFileId] })
    t.is(missingContext.status, 422)

    const wrongReportType = await agent
      .post('/examine/suggestions')
      .send({
        type: 'expense',
        reportType: 'ExpenseReport',
        projectId,
        documentFileIds: [documentFileId],
        reportId,
        sourceReportType: 'Travel'
      })
    t.is(wrongReportType.status, 403)

    const wrongProject = await agent
      .post('/examine/suggestions')
      .send({
        type: 'expense',
        reportType: 'ExpenseReport',
        projectId: documentFileId,
        documentFileIds: [documentFileId],
        reportId,
        sourceReportType: 'ExpenseReport'
      })
    t.is(wrongProject.status, 403)
  } finally {
    await loginUser(agent, 'user')
  }
})

test.serial('POST /suggestions returns validated OpenAI-compatible JSON', async (t) => {
  const settings = await ConnectionSettings.findOne()
  if (!settings) return t.fail('Connection settings missing')
  const originalLlm = settings.toObject().llm
  settings.llm = {
    baseUrl: 'http://llm.test/v1',
    model: 'test-model',
    apiKey: 'secret',
    reasoningEffort: 'low',
    maxTokens: 1_024,
    maxPromptOcrCharacters: 20,
    timeoutSeconds: 12
  }
  await settings.save()
  await DocumentFile.findByIdAndUpdate(documentFileId, { ocr: 'Invoice date 2026-07-24, total 10.70 EUR' })

  const originalPost = axios.post
  let requestedUrl = ''
  const requestedBodies: RequestedSuggestionBody[] = []
  let requestedAuthorization = ''
  let requestedTimeout = 0
  axios.post = (async (url: string, body: unknown, config: { headers?: { Authorization?: string }; timeout?: number }) => {
    requestedUrl = url
    requestedBodies.push(body as RequestedSuggestionBody)
    requestedAuthorization = config.headers?.Authorization ?? ''
    requestedTimeout = config.timeout ?? 0
    const schemaName = requestedBodies.at(-1)?.response_format.json_schema.name
    const suggestion: ReceiptSuggestion =
      schemaName === 'receipt_stage_suggestion'
        ? {
            type: 'stage',
            departure: '2026-07-24T09:00',
            arrival: '2026-07-24T13:00',
            startLocation: { place: 'Berlin', countryCode: 'DE' },
            endLocation: { place: 'Paris', countryCode: 'FR' },
            transportType: 'otherTransport',
            cost: { date: '2026-07-24', currencyCode: 'EUR', positions: [{ grossAmount: 10.7, vatRate: 7 }] }
          }
        : {
            type: 'expense',
            description: 'Lunch',
            cost: {
              date: '2026-07-24',
              currencyCode: 'EUR',
              positions: [
                { description: 'Meal', grossAmount: 10.7, vatRate: 7 },
                { description: 'Drinks', grossAmount: 5.9, vatRate: 7 }
              ]
            }
          }
    return { data: { choices: [{ message: { content: JSON.stringify(suggestion) } }] } }
  }) as typeof axios.post

  try {
    const response = await agent
      .post('/suggestions')
      .send({ type: 'expense', reportType: 'Travel', projectId, documentFileIds: [documentFileId] })

    t.is(response.status, 200)
    t.is(response.headers['cache-control'], 'no-store')
    t.deepEqual(response.body.result, {
      type: 'expense',
      description: 'Lunch',
      cost: {
        date: '2026-07-24',
        currencyCode: 'EUR',
        positions: [
          { description: 'Meal', grossAmount: 10.7, vatRate: 7 },
          { description: 'Drinks', grossAmount: 5.9, vatRate: 7 }
        ]
      }
    })
    t.is(requestedUrl, 'http://llm.test/v1/chat/completions')
    t.is(requestedAuthorization, 'Bearer secret')
    t.is(requestedTimeout, 12_000)
    const expenseBody = requestedBodies[0]
    t.like(expenseBody, { model: 'test-model', temperature: 0, max_tokens: 1_024, reasoning_effort: 'low' })
    t.like(expenseBody.response_format, { type: 'json_schema', json_schema: { name: 'receipt_expense_suggestion', strict: true } })
    t.regex(expenseBody.messages[0].content, /expense/)
    const expensePrompt = JSON.parse(expenseBody.messages[1].content)
    t.deepEqual(Object.keys(expensePrompt), ['categories', 'vatRates', 'documents'])
    t.deepEqual(expensePrompt.vatRates, [0, 7, 19])
    t.is(expensePrompt.documents[0].text, 'Invoice date 2026-07')
    const expenseCostSchema = expenseBody.response_format.json_schema.schema.properties.cost
    t.is(expenseCostSchema.properties.currencyCode.pattern, '^[A-Z]{3}$')
    t.false(Object.hasOwn(expenseCostSchema.properties.currencyCode, 'enum'))
    const positionsSchema = expenseCostSchema.properties.positions
    t.false(Object.hasOwn(positionsSchema, 'maxItems'))

    const stageResponse = await agent
      .post('/suggestions')
      .send({ type: 'stage', reportType: 'Travel', projectId, documentFileIds: [documentFileId] })
    t.is(stageResponse.status, 200)
    t.like(stageResponse.body.result, {
      type: 'stage',
      startLocation: { place: 'Berlin', countryCode: 'DE' },
      endLocation: { place: 'Paris', countryCode: 'FR' },
      transportType: 'otherTransport'
    })
    const stageBody = requestedBodies[1]
    t.is(stageBody.response_format.json_schema.name, 'receipt_stage_suggestion')
    t.regex(stageBody.messages[0].content, /travel stage/)
    t.not(stageBody.messages[0].content, expenseBody.messages[0].content)
    const stagePrompt = JSON.parse(stageBody.messages[1].content)
    t.deepEqual(Object.keys(stagePrompt), ['categories', 'vatRates', 'documents'])
    const countryCodeSchema = stageBody.response_format.json_schema.schema.properties.startLocation.properties.countryCode
    t.is(countryCodeSchema.pattern, '^[A-Z]{2}$')
    t.false(Object.hasOwn(countryCodeSchema, 'enum'))

    await loginUser(agent, 'expenseReport')
    const examinedResponse = await agent
      .post('/examine/suggestions')
      .send({
        type: 'expense',
        reportType: 'ExpenseReport',
        projectId,
        documentFileIds: [documentFileId],
        reportId,
        sourceReportType: 'ExpenseReport'
      })
    t.is(examinedResponse.status, 200)
    t.deepEqual(examinedResponse.body.result, response.body.result)
  } finally {
    await loginUser(agent, 'user')
    axios.post = originalPost
    settings.llm = originalLlm
    await settings.save()
  }
})

test.serial('POST /suggestions returns 502 and logs actionable connection details for LLM failures', async (t) => {
  const settings = await ConnectionSettings.findOne()
  if (!settings) return t.fail('Connection settings missing')
  const originalLlm = settings.toObject().llm
  settings.llm = {
    baseUrl: 'http://llm.test/v1',
    model: 'test-model',
    apiKey: 'secret',
    reasoningEffort: null,
    maxTokens: null,
    maxPromptOcrCharacters: 40_000,
    timeoutSeconds: 7
  }
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
      .post('/suggestions')
      .send({ type: 'expense', reportType: 'Travel', projectId, documentFileIds: [documentFileId] })

    t.is(response.status, 502)
    t.is(response.body.name, 'alerts.upstreamServiceError')
    t.like(loggedDetails as object, { endpoint: 'http://llm.test/v1/chat/completions', model: 'test-model', code: 'ECONNREFUSED' })
    t.is(requestedTimeout, 7_000)
    t.false(Object.hasOwn(requestedBody as object, 'reasoning_effort'))
    t.false(Object.hasOwn(requestedBody as object, 'max_tokens'))
  } finally {
    axios.post = originalPost
    logger.error = originalLoggerError
    settings.llm = originalLlm
    await settings.save()
  }
})

test.serial('POST /suggestions returns no content without LLM settings', async (t) => {
  const settings = await ConnectionSettings.findOne()
  if (!settings) return t.fail('Connection settings missing')
  const originalLlm = settings.toObject().llm
  settings.llm = null
  await settings.save()

  try {
    const response = await agent
      .post('/suggestions')
      .send({ type: 'expense', reportType: 'Travel', projectId, documentFileIds: [documentFileId] })
    t.is(response.status, 204)
  } finally {
    settings.llm = originalLlm
    await settings.save()
  }
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
