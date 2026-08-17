import { Readable } from 'node:stream'
import { McpServer, ToolAnnotations } from '@modelcontextprotocol/server'
import { Access, documentFileTypes, Expense, idDocumentToId, Stage, TravelExpense } from 'abrechnung-common/types.js'
import { mongo, Types } from 'mongoose'
import * as z from 'zod/v4'
import {
  AdvanceApproveController,
  AdvanceBookableController,
  AdvanceController,
  AdvanceExamineController
} from '../controller/advanceController.js'
import { CategoryController } from '../controller/categoryController.js'
import { GetterQuery } from '../controller/controller.js'
import { CountryController } from '../controller/countryController.js'
import { CurrencyController } from '../controller/currencyController.js'
import { DocumentFileAdminController, DocumentFileController } from '../controller/documentFileController.js'
import { ClientError, ReadOnlyError, ValidationClientError } from '../controller/error.js'
import {
  ExpenseReportBookableController,
  ExpenseReportController,
  ExpenseReportExamineController
} from '../controller/expenseReportController.js'
import { OrganisationController } from '../controller/organisationController.js'
import { ProjectController } from '../controller/projectController.js'
import { SearchController } from '../controller/searchController.js'
import {
  TravelApproveController,
  TravelBookableController,
  TravelController,
  TravelExamineController
} from '../controller/travelController.js'
import { AuthenticatedExpressRequest } from '../controller/types.js'
import { UserController, UsersController } from '../controller/userController.js'
import { BACKEND_CACHE } from '../db.js'
import ENV from '../env.js'
import { saveDocumentFile } from '../helper.js'
import { logger } from '../logger.js'
import Advance from '../models/advance.js'
import DocumentFile from '../models/documentFile.js'
import ExpenseReport from '../models/expenseReport.js'
import Travel from '../models/travel.js'
import { UserDoc } from '../models/user.js'

const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, 'Expected a MongoDB ObjectId')
const referenceSchema = z.union([objectIdSchema, z.object({ _id: objectIdSchema })])
const countryReferenceSchema = z.union([z.string().regex(/^[A-Z]{2}$/), z.object({ _id: z.string().regex(/^[A-Z]{2}$/) })])
const currencyReferenceSchema = z.union([z.string().regex(/^[A-Z]{3}$/), z.object({ _id: z.string().regex(/^[A-Z]{3}$/) })])
const reportTypeSchema = z.enum(['travel', 'advance', 'expenseReport'])
const paginationSchema = { page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(50).default(20) }
const commentSchema = z.string().trim().max(4_000).optional()

const moneySchema = z.object({
  amount: z.number(),
  currency: currencyReferenceSchema,
  exchangeRate: z.object({ date: z.iso.datetime(), rate: z.number().positive(), amount: z.number().optional() }).optional().nullable()
})

const placeSchema = z.object({ place: z.string().trim().min(1), country: countryReferenceSchema, special: z.string().trim().optional() })
const costPositionSchema = z.object({
  _id: objectIdSchema.optional(),
  kind: z.enum(['manual', 'ownCar']),
  description: z.string().trim().optional().nullable(),
  grossAmount: z.number(),
  vatRate: z.number(),
  vatAmountOverride: z.number().optional(),
  project: referenceSchema,
  category: referenceSchema
})
const costSchema = z.object({
  positions: z.array(costPositionSchema),
  currency: currencyReferenceSchema,
  exchangeRate: z.object({ date: z.iso.datetime(), rate: z.number().positive() }).optional().nullable(),
  date: z.iso.datetime().optional().nullable(),
  receipts: z.array(referenceSchema).optional()
})
const expenseSchema = z.object({
  _id: objectIdSchema.optional(),
  description: z.string().trim().min(1),
  cost: costSchema,
  note: z.string().trim().optional().nullable(),
  purpose: z.enum(['professional', 'mixed']).optional()
})
const stageSchema = z.object({
  _id: objectIdSchema.optional(),
  departure: z.iso.datetime(),
  arrival: z.iso.datetime(),
  startLocation: placeSchema,
  endLocation: placeSchema,
  midnightCountries: z
    .array(z.object({ date: z.iso.datetime(), country: countryReferenceSchema }))
    .optional()
    .nullable(),
  transport: z.union([
    z.object({ type: z.enum(['airplane', 'shipOrFerry', 'otherTransport']) }),
    z.object({
      type: z.literal('ownCar'),
      distance: z.number().nonnegative(),
      distanceRefundType: z.enum(['car', 'motorcycle', 'halfCar'])
    })
  ]),
  cost: costSchema,
  purpose: z.enum(['professional', 'private', 'mixed']),
  note: z.string().trim().optional().nullable()
})

const travelApplicationSchema = z.object({
  _id: objectIdSchema.optional(),
  name: z.string().trim().optional(),
  project: referenceSchema,
  reason: z.string().trim().min(1),
  destinationPlace: z.object({ place: z.string().trim().min(1), country: countryReferenceSchema }),
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
  claimSpouseRefund: z.boolean().optional().nullable(),
  fellowTravelersNames: z.string().trim().optional().nullable(),
  isCrossBorder: z.boolean().optional().nullable(),
  a1Certificate: z.object({ exactAddress: z.string(), destinationName: z.string() }).optional().nullable(),
  advance: moneySchema.optional(),
  comment: commentSchema
})

const advanceApplicationSchema = z.object({
  _id: objectIdSchema.optional(),
  name: z.string().trim().optional(),
  project: referenceSchema,
  budget: moneySchema,
  reason: z.string().trim().min(1),
  comment: commentSchema,
  bookingRemark: z.string().trim().optional().nullable()
})

const expenseReportSchema = z.object({
  _id: objectIdSchema.optional(),
  name: z.string().trim().optional(),
  project: referenceSchema,
  advances: z.array(referenceSchema).optional(),
  comment: commentSchema
})

const readAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } satisfies ToolAnnotations
const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false
} satisfies ToolAnnotations
const destructiveAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false
} satisfies ToolAnnotations

function requestFor(user: UserDoc) {
  return { user } as unknown as AuthenticatedExpressRequest
}

function hasAnyAccess(user: UserDoc, accesses: Access[]) {
  return accesses.some((access) => user.access[access])
}

function assertWritable() {
  if (BACKEND_CACHE.settings.isReadOnly) throw new ReadOnlyError()
}

function serialize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Types.ObjectId) return value.toString()
  if (Buffer.isBuffer(value) || value instanceof mongo.Binary) return undefined
  if (typeof value !== 'object') return String(value)
  if ('toObject' in value && typeof value.toObject === 'function') return serialize(value.toObject(), seen)
  if (seen.has(value)) return undefined
  seen.add(value)
  if (Array.isArray(value)) {
    const result = value.map((entry) => serialize(entry, seen)).filter((entry) => entry !== undefined)
    seen.delete(value)
    return result
  }
  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (key === '__v') continue
    const serialized = serialize(entry, seen)
    if (serialized !== undefined) result[key] = serialized
  }
  seen.delete(value)
  return result
}

function success(data: unknown, summary = 'Operation completed successfully') {
  const serialized = serialize(data)
  return { content: [{ type: 'text' as const, text: summary }], structuredContent: { data: serialized } }
}

function failure(error: unknown) {
  if (!(error instanceof ClientError)) logger.warn(error)
  const details =
    error instanceof ClientError
      ? { code: error.name, status: error.status, message: error.message, ...('errors' in error ? { errors: error.errors } : {}) }
      : { code: 'internal_error', status: 500, message: 'The operation could not be completed' }
  return {
    content: [{ type: 'text' as const, text: `${details.code}: ${details.message}` }],
    structuredContent: { error: serialize(details) },
    isError: true
  }
}

async function execute(operation: () => Promise<unknown>, options: { mutation?: boolean; summary?: string } = {}) {
  try {
    if (options.mutation) assertWritable()
    return success(await operation(), options.summary)
  } catch (error) {
    return failure(error)
  }
}

async function readableToBuffer(readable: Readable) {
  const chunks: Buffer[] = []
  for await (const chunk of readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

// biome-ignore lint/suspicious/noExplicitAny: one pagination shape is passed to controllers with different model-specific field unions
function getterQuery(input: { page: number; limit: number; _id?: string }, additionalFields?: string[]): GetterQuery<any> {
  return { page: input.page, limit: input.limit, _id: input._id, additionalFields }
}

function toPlainObject(value: unknown) {
  if (value && typeof value === 'object' && 'toObject' in value && typeof value.toObject === 'function') {
    return value.toObject() as Record<string, unknown>
  }
  return { ...(value as Record<string, unknown>) }
}

async function getReportOwner(reportType: z.infer<typeof reportTypeSchema>, reportId: string) {
  const report =
    reportType === 'travel'
      ? await Travel.findOne({ _id: reportId, historic: false }, { owner: 1 }).lean()
      : reportType === 'advance'
        ? await Advance.findOne({ _id: reportId, historic: false }, { owner: 1 }).lean()
        : await ExpenseReport.findOne({ _id: reportId, historic: false }, { owner: 1 }).lean()
  if (!report) throw new ValidationClientError(`No ${reportType} with id '${reportId}' found`)
  return idDocumentToId(report.owner).toString()
}

function isOwn(user: UserDoc, ownerId: string) {
  return user._id.equals(ownerId)
}

async function listReports(
  user: UserDoc,
  input: {
    reportType: z.infer<typeof reportTypeSchema>
    view: 'own' | 'approval' | 'review' | 'bookable'
    page: number
    limit: number
    _id?: string
  }
) {
  const request = requestFor(user)
  const query = getterQuery(input, input.reportType === 'travel' ? ['expenses', 'stages', 'days'] : ['expenses'])
  if (input.view === 'own') {
    if (input.reportType === 'travel') return await new TravelController().getOwn(query, request)
    if (input.reportType === 'advance') return await new AdvanceController().getOwn(query, request)
    return await new ExpenseReportController().getOwn(query, request)
  }
  if (input.view === 'approval') {
    if (input.reportType === 'travel' && user.access['approve/travel'])
      return await new TravelApproveController().getToApprove(query, request)
    if (input.reportType === 'advance' && user.access['approve/advance'])
      return await new AdvanceApproveController().getToApprove(query, request)
    throw new ValidationClientError(`The approval view is not available for ${input.reportType}`)
  }
  if (input.view === 'review') {
    if (input.reportType === 'travel' && user.access['examine/travel'])
      return await new TravelExamineController().getToExamine(query, request)
    if (input.reportType === 'expenseReport' && user.access['examine/expenseReport'])
      return await new ExpenseReportExamineController().getToExamine(query, request)
    if (input.reportType === 'advance' && hasAnyAccess(user, ['approve/travel', 'examine/travel', 'examine/expenseReport']))
      return await new AdvanceExamineController().getForExamineReport(query, request)
    throw new ValidationClientError(`The review view is not available for ${input.reportType}`)
  }
  if (input.reportType === 'travel' && user.access['book/travel']) return await new TravelBookableController().getBookable(query, request)
  if (input.reportType === 'advance' && user.access['book/advance'])
    return await new AdvanceBookableController().getBookable(query, request)
  if (input.reportType === 'expenseReport' && user.access['book/expenseReport'])
    return await new ExpenseReportBookableController().getBookable(query, request)
  throw new ValidationClientError(`The bookable view is not available for ${input.reportType}`)
}

async function getReport(user: UserDoc, reportType: z.infer<typeof reportTypeSchema>, reportId: string) {
  const ownerId = await getReportOwner(reportType, reportId)
  const views: Array<'own' | 'approval' | 'review' | 'bookable'> = isOwn(user, ownerId) ? ['own'] : ['review', 'approval', 'bookable']
  let lastError: unknown
  for (const view of views) {
    try {
      return await listReports(user, { reportType, view, page: 1, limit: 1, _id: reportId })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

async function upsertExpense(
  user: UserDoc,
  reportType: 'travel' | 'expenseReport',
  reportId: string,
  expense: z.infer<typeof expenseSchema>
) {
  const ownerId = await getReportOwner(reportType, reportId)
  const request = requestFor(user)
  if (isOwn(user, ownerId)) {
    if (reportType === 'travel')
      return await new TravelController().postExpenseToOwn(
        reportId,
        expense as unknown as TravelExpense<Types.ObjectId, mongo.Binary>,
        request
      )
    return await new ExpenseReportController().postExpenseToOwn(
      reportId,
      expense as unknown as Expense<Types.ObjectId, mongo.Binary>,
      request
    )
  }
  if (reportType === 'travel' && user.access['examine/travel'])
    return await new TravelExamineController().postExpenseToAny(
      reportId,
      expense as unknown as TravelExpense<Types.ObjectId, mongo.Binary>,
      request
    )
  if (reportType === 'expenseReport' && user.access['examine/expenseReport'])
    return await new ExpenseReportExamineController().postExpenseToAny(
      reportId,
      expense as unknown as Expense<Types.ObjectId, mongo.Binary>,
      request
    )
  throw new ValidationClientError('Not allowed to edit expenses on this report')
}

async function upsertStage(user: UserDoc, reportId: string, stage: z.infer<typeof stageSchema>) {
  const ownerId = await getReportOwner('travel', reportId)
  const request = requestFor(user)
  if (isOwn(user, ownerId))
    return await new TravelController().postStageToOwn(reportId, stage as unknown as Stage<Types.ObjectId, mongo.Binary>, request)
  if (user.access['examine/travel'])
    return await new TravelExamineController().postStageToAny(reportId, stage as unknown as Stage<Types.ObjectId, mongo.Binary>, request)
  throw new ValidationClientError('Not allowed to edit stages on this travel')
}

async function deleteReportItem(
  user: UserDoc,
  input: { reportType: 'travel' | 'expenseReport'; reportId: string; itemType: 'expense' | 'stage'; itemId: string }
) {
  const ownerId = await getReportOwner(input.reportType, input.reportId)
  const request = requestFor(user)
  if (input.itemType === 'stage' && input.reportType !== 'travel') throw new ValidationClientError('Only travels contain stages')
  if (isOwn(user, ownerId)) {
    if (input.itemType === 'stage') return await new TravelController().deleteStageFromOwn(input.itemId, input.reportId, request)
    if (input.reportType === 'travel') return await new TravelController().deleteExpeneseFromOwn(input.itemId, input.reportId, request)
    return await new ExpenseReportController().deleteExpenseFromOwn(input.itemId, input.reportId, request)
  }
  if (input.reportType === 'travel' && user.access['examine/travel']) {
    if (input.itemType === 'stage') return await new TravelExamineController().deleteStageFromAny(input.itemId, input.reportId, request)
    return await new TravelExamineController().deleteExpeneseFromAny(input.itemId, input.reportId, request)
  }
  if (input.reportType === 'expenseReport' && user.access['examine/expenseReport'])
    return await new ExpenseReportExamineController().deleteExpenseFromAny(input.itemId, input.reportId, request)
  throw new ValidationClientError('Not allowed to delete this report item')
}

async function deleteReport(user: UserDoc, reportType: z.infer<typeof reportTypeSchema>, reportId: string) {
  const ownerId = await getReportOwner(reportType, reportId)
  const request = requestFor(user)
  if (isOwn(user, ownerId)) {
    if (reportType === 'travel') return await new TravelController().deleteOwn(reportId, request)
    if (reportType === 'advance') return await new AdvanceController().deleteOwn(reportId, request)
    return await new ExpenseReportController().deleteOwn(reportId, request)
  }
  if (reportType === 'travel' && user.access['examine/travel']) {
    return await new TravelExamineController().deleteAny(reportId, request)
  }
  if (reportType === 'advance' && user.access['approve/advance']) {
    return await new AdvanceApproveController().deleteApproved(reportId, request)
  }
  throw new ValidationClientError('Not allowed to delete this report')
}

async function findReportItem(input: {
  reportType: 'travel' | 'expenseReport'
  reportId: string
  itemType: 'expense' | 'stage'
  itemId: string
}) {
  if (input.reportType === 'travel') {
    const report = await Travel.findOne({ _id: input.reportId, historic: false })
    if (!report) throw new ValidationClientError('Report not found')
    const items = input.itemType === 'stage' ? report.stages : report.expenses
    const item = items.find((entry) => entry._id.equals(input.itemId))
    if (!item) throw new ValidationClientError('Report item not found')
    return { report, item }
  }
  if (input.itemType === 'stage') throw new ValidationClientError('Only travels contain stages')
  const report = await ExpenseReport.findOne({ _id: input.reportId, historic: false })
  if (!report) throw new ValidationClientError('Report not found')
  const item = report.expenses.find((entry) => entry._id.equals(input.itemId))
  if (!item) throw new ValidationClientError('Report item not found')
  return { report, item }
}

async function saveReceipt(
  user: UserDoc,
  input: {
    reportType: 'travel' | 'expenseReport'
    reportId: string
    itemType: 'expense' | 'stage'
    itemId: string
    name: string
    mediaType: (typeof documentFileTypes)[number]
    dataBase64: string
  }
) {
  const data = Buffer.from(input.dataBase64, 'base64')
  if (data.length === 0 || data.toString('base64').replace(/=+$/, '') !== input.dataBase64.replace(/\s+/g, '').replace(/=+$/, '')) {
    throw new ValidationClientError('Invalid base64 file data')
  }
  if (data.length > ENV.VITE_MAX_FILE_SIZE) throw new ValidationClientError('File exceeds VITE_MAX_FILE_SIZE')
  const { report, item } = await findReportItem(input)
  const file = await saveDocumentFile({ name: input.name, type: input.mediaType, data }, idDocumentToId(report.owner))
  try {
    const updated = { ...toPlainObject(item), cost: { ...toPlainObject(item.cost), receipts: [...item.cost.receipts, file._id] } }
    if (input.itemType === 'stage') return await upsertStage(user, input.reportId, updated as unknown as z.infer<typeof stageSchema>)
    return await upsertExpense(user, input.reportType, input.reportId, updated as unknown as z.infer<typeof expenseSchema>)
  } catch (error) {
    await file.deleteOne()
    throw error
  }
}

async function removeReceipt(
  user: UserDoc,
  input: { reportType: 'travel' | 'expenseReport'; reportId: string; itemType: 'expense' | 'stage'; itemId: string; documentId: string }
) {
  const { item } = await findReportItem(input)
  if (!item.cost.receipts.some((receipt) => idDocumentToId(receipt).equals(input.documentId)))
    throw new ValidationClientError('Receipt not found on item')
  const updated = {
    ...toPlainObject(item),
    cost: {
      ...toPlainObject(item.cost),
      receipts: item.cost.receipts.filter((receipt) => !idDocumentToId(receipt).equals(input.documentId))
    }
  }
  const result =
    input.itemType === 'stage'
      ? await upsertStage(user, input.reportId, updated as unknown as z.infer<typeof stageSchema>)
      : await upsertExpense(user, input.reportType, input.reportId, updated as unknown as z.infer<typeof expenseSchema>)
  await DocumentFile.deleteOne({ _id: input.documentId })
  return result
}

export function createMcpServer(user: UserDoc) {
  const server = new McpServer({ name: 'abrechnung', version: '2.6.4' })
  const request = requestFor(user)

  server.registerTool(
    'get_current_user',
    {
      title: 'Get current user',
      description: 'Return the authenticated Abrechnung user and current permissions.',
      annotations: readAnnotations
    },
    async () => execute(async () => await new UserController().getMe(request))
  )
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description: 'List projects visible to the authenticated user.',
      inputSchema: z.object(paginationSchema),
      annotations: readAnnotations
    },
    async (input) => execute(async () => await new ProjectController().get(getterQuery(input), request))
  )
  server.registerTool(
    'list_categories',
    { title: 'List categories', inputSchema: z.object(paginationSchema), annotations: readAnnotations },
    async (input) => execute(async () => await new CategoryController().get(getterQuery(input)))
  )
  server.registerTool(
    'list_currencies',
    { title: 'List currencies', inputSchema: z.object(paginationSchema), annotations: readAnnotations },
    async (input) => execute(async () => await new CurrencyController().get(getterQuery(input)))
  )
  server.registerTool(
    'list_countries',
    { title: 'List countries', inputSchema: z.object(paginationSchema), annotations: readAnnotations },
    async (input) => execute(async () => await new CountryController().get(getterQuery(input)))
  )
  server.registerTool(
    'list_organisations',
    { title: 'List organisations', inputSchema: z.object(paginationSchema), annotations: readAnnotations },
    async (input) => execute(async () => await new OrganisationController().get(getterQuery(input)))
  )
  if (hasAnyAccess(user, ['approve/advance', 'approve/travel', 'examine/travel', 'examine/expenseReport', 'admin'])) {
    server.registerTool(
      'list_users',
      { title: 'List users', inputSchema: z.object(paginationSchema), annotations: readAnnotations },
      async (input) => execute(async () => await new UsersController().getNamesAndProjects(getterQuery(input)))
    )
  }
  server.registerTool(
    'search_reports',
    {
      title: 'Search reports',
      description: "Search reports within the caller's owner, project and special-access boundaries.",
      inputSchema: z.object({ term: z.string().trim().min(1), ...paginationSchema }),
      annotations: readAnnotations
    },
    async (input) => execute(async () => await new SearchController().get(input, request))
  )
  server.registerTool(
    'list_reports',
    {
      title: 'List reports',
      description: 'List own, approval, review or bookable Travel, Advance and Expense Report records.',
      inputSchema: z.object({ reportType: reportTypeSchema, view: z.enum(['own', 'approval', 'review', 'bookable']), ...paginationSchema }),
      annotations: readAnnotations
    },
    async (input) => execute(async () => await listReports(user, input))
  )
  server.registerTool(
    'get_report',
    {
      title: 'Get report',
      inputSchema: z.object({ reportType: reportTypeSchema, reportId: objectIdSchema }),
      annotations: readAnnotations
    },
    async (input) => execute(async () => await getReport(user, input.reportType, input.reportId))
  )
  server.registerTool(
    'delete_report',
    {
      title: 'Delete a report',
      description: 'Delete an own report, or a foreign report when the matching special access permits deletion in its current state.',
      inputSchema: z.object({ reportType: reportTypeSchema, reportId: objectIdSchema }),
      annotations: destructiveAnnotations
    },
    async (input) => execute(async () => await deleteReport(user, input.reportType, input.reportId), { mutation: true })
  )

  if (user.access['appliedFor:travel']) {
    server.registerTool(
      'save_travel_application',
      { title: 'Create or update own travel application', inputSchema: travelApplicationSchema, annotations: writeAnnotations },
      async (input) =>
        execute(
          async () =>
            await new TravelController().postOwnInWork(
              structuredClone(input) as unknown as Parameters<TravelController['postOwnInWork']>[0],
              request
            ),
          { mutation: true }
        )
    )
  }
  if (user.access['approved:travel']) {
    server.registerTool(
      'save_own_approved_travel',
      {
        title: 'Create or update an own travel without approval',
        inputSchema: travelApplicationSchema,
        annotations: destructiveAnnotations
      },
      async (input) =>
        execute(
          async () =>
            await new TravelController().postOwnApproved(
              structuredClone(input) as unknown as Parameters<TravelController['postOwnApproved']>[0],
              request
            ),
          { mutation: true }
        )
    )
  }
  server.registerTool(
    'save_travel_claim',
    {
      title: 'Update travel claim days and last place of work',
      inputSchema: z.object({
        reportId: objectIdSchema,
        lastPlaceOfWork: z.object({ country: countryReferenceSchema, special: z.string().optional() }).optional().nullable(),
        days: z.array(
          z.object({
            date: z.iso.datetime(),
            country: countryReferenceSchema,
            special: z.string().optional(),
            cateringRefund: z.object({ breakfast: z.boolean(), lunch: z.boolean(), dinner: z.boolean() }),
            overnightRefund: z.boolean(),
            purpose: z.enum(['professional', 'private'])
          })
        )
      }),
      annotations: writeAnnotations
    },
    async (input) =>
      execute(
        async () => {
          const body = { _id: input.reportId, days: input.days, lastPlaceOfWork: input.lastPlaceOfWork }
          const ownerId = await getReportOwner('travel', input.reportId)
          if (isOwn(user, ownerId)) {
            return await new TravelController().postLumpSums(body as unknown as Parameters<TravelController['postLumpSums']>[0], request)
          }
          if (user.access['examine/travel']) {
            return await new TravelExamineController().postAny(
              body as unknown as Parameters<TravelExamineController['postAny']>[0],
              request
            )
          }
          throw new ValidationClientError('Not allowed to update this travel claim')
        },
        { mutation: true }
      )
  )
  if (user.access['appliedFor:advance']) {
    server.registerTool(
      'save_advance_application',
      { title: 'Create or update own advance application', inputSchema: advanceApplicationSchema, annotations: writeAnnotations },
      async (input) =>
        execute(
          async () =>
            await new AdvanceController().postOwnInWork(
              structuredClone(input) as unknown as Parameters<AdvanceController['postOwnInWork']>[0],
              request
            ),
          { mutation: true }
        )
    )
  }
  if (user.access['inWork:expenseReport']) {
    server.registerTool(
      'save_expense_report',
      { title: 'Create or update own expense report', inputSchema: expenseReportSchema, annotations: writeAnnotations },
      async (input) =>
        execute(
          async () =>
            await new ExpenseReportController().postOwnInWork(
              structuredClone(input) as unknown as Parameters<ExpenseReportController['postOwnInWork']>[0],
              request
            ),
          { mutation: true }
        )
    )
  }
  server.registerTool(
    'upsert_travel_stage',
    {
      title: 'Add or update a travel stage',
      inputSchema: z.object({ reportId: objectIdSchema, stage: stageSchema }),
      annotations: writeAnnotations
    },
    async (input) => execute(async () => await upsertStage(user, input.reportId, input.stage), { mutation: true })
  )
  server.registerTool(
    'upsert_report_expense',
    {
      title: 'Add or update a report expense',
      inputSchema: z.object({ reportType: z.enum(['travel', 'expenseReport']), reportId: objectIdSchema, expense: expenseSchema }),
      annotations: writeAnnotations
    },
    async (input) => execute(async () => await upsertExpense(user, input.reportType, input.reportId, input.expense), { mutation: true })
  )
  server.registerTool(
    'delete_report_item',
    {
      title: 'Delete a stage or expense',
      inputSchema: z.object({
        reportType: z.enum(['travel', 'expenseReport']),
        reportId: objectIdSchema,
        itemType: z.enum(['expense', 'stage']),
        itemId: objectIdSchema
      }),
      annotations: destructiveAnnotations
    },
    async (input) => execute(async () => await deleteReportItem(user, input), { mutation: true })
  )
  server.registerTool(
    'upload_receipt',
    {
      title: 'Upload and attach a receipt',
      inputSchema: z.object({
        reportType: z.enum(['travel', 'expenseReport']),
        reportId: objectIdSchema,
        itemType: z.enum(['expense', 'stage']),
        itemId: objectIdSchema,
        name: z.string().trim().min(1).max(255),
        mediaType: z.enum(documentFileTypes),
        dataBase64: z.string().min(1)
      }),
      annotations: writeAnnotations
    },
    async (input) => execute(async () => await saveReceipt(user, input), { mutation: true })
  )
  server.registerTool(
    'delete_receipt',
    {
      title: 'Detach and delete a receipt',
      inputSchema: z.object({
        reportType: z.enum(['travel', 'expenseReport']),
        reportId: objectIdSchema,
        itemType: z.enum(['expense', 'stage']),
        itemId: objectIdSchema,
        documentId: objectIdSchema
      }),
      annotations: destructiveAnnotations
    },
    async (input) => execute(async () => await removeReceipt(user, input), { mutation: true })
  )

  if (user.access['approve/travel']) {
    server.registerTool(
      'create_approved_travel_for_user',
      {
        title: 'Create an approved travel for another user',
        inputSchema: travelApplicationSchema.omit({ _id: true }).extend({ ownerId: objectIdSchema }),
        annotations: destructiveAnnotations
      },
      async (input) =>
        execute(
          async () => {
            const { ownerId, ...body } = input
            return await new TravelApproveController().postAnyApproved(
              { ...structuredClone(body), owner: ownerId } as unknown as Parameters<TravelApproveController['postAnyApproved']>[0],
              request
            )
          },
          { mutation: true }
        )
    )
    for (const [name, title, method] of [
      ['approve_travel', 'Approve a travel application', 'postAnyApproved'],
      ['reject_travel', 'Reject a travel application', 'postAnyRejected'],
      ['withdraw_travel_approval', 'Withdraw a travel approval', 'withdrawApproval']
    ] as const) {
      server.registerTool(
        name,
        { title, inputSchema: z.object({ reportId: objectIdSchema, comment: commentSchema }), annotations: destructiveAnnotations },
        async (input) =>
          execute(
            async () => await new TravelApproveController()[method]({ _id: input.reportId, comment: input.comment } as never, request),
            { mutation: true }
          )
      )
    }
  }
  if (user.access['approve/advance']) {
    server.registerTool(
      'create_approved_advance_for_user',
      {
        title: 'Create an approved advance for another user',
        inputSchema: advanceApplicationSchema.omit({ _id: true }).extend({ ownerId: objectIdSchema }),
        annotations: destructiveAnnotations
      },
      async (input) =>
        execute(
          async () => {
            const { ownerId, ...body } = input
            return await new AdvanceApproveController().postAnyApproved(
              { ...structuredClone(body), owner: ownerId } as unknown as Parameters<AdvanceApproveController['postAnyApproved']>[0],
              request
            )
          },
          { mutation: true }
        )
    )
    for (const [name, title, method] of [
      ['approve_advance', 'Approve an advance application', 'postAnyApproved'],
      ['reject_advance', 'Reject an advance application', 'postAnyRejected'],
      ['withdraw_advance_approval', 'Withdraw an advance approval', 'withdrawApproval']
    ] as const) {
      server.registerTool(
        name,
        { title, inputSchema: z.object({ reportId: objectIdSchema, comment: commentSchema }), annotations: destructiveAnnotations },
        async (input) =>
          execute(
            async () => await new AdvanceApproveController()[method]({ _id: input.reportId, comment: input.comment } as never, request),
            { mutation: true }
          )
      )
    }
    server.registerTool(
      'offset_advance',
      {
        title: 'Offset an approved advance manually',
        inputSchema: z.object({ advanceId: objectIdSchema, amount: z.number().positive(), subject: z.string().trim().min(1) }),
        annotations: destructiveAnnotations
      },
      async (input) => execute(async () => await new AdvanceApproveController().offset(input, request), { mutation: true })
    )
  }
  server.registerTool(
    'confirm_advance_received',
    {
      title: 'Confirm receipt of an own advance',
      inputSchema: z.object({ reportId: objectIdSchema, receivedOn: z.iso.datetime() }),
      annotations: destructiveAnnotations
    },
    async (input) =>
      execute(async () => await new AdvanceController().postReceived({ _id: input.reportId, receivedOn: input.receivedOn }, request), {
        mutation: true
      })
  )
  server.registerTool(
    'submit_report_for_review',
    {
      title: 'Submit a travel or expense report for review',
      inputSchema: z.object({ reportType: z.enum(['travel', 'expenseReport']), reportId: objectIdSchema, comment: commentSchema }),
      annotations: destructiveAnnotations
    },
    async (input) =>
      execute(
        async () => {
          const ownerId = await getReportOwner(input.reportType, input.reportId)
          const body = { _id: input.reportId, comment: input.comment }
          if (input.reportType === 'travel') {
            if (isOwn(user, ownerId)) return await new TravelController().postOwnUnderExamination(body, request)
            if (user.access['examine/travel']) return await new TravelExamineController().postAnyUnderExamination(body, request)
          } else {
            if (isOwn(user, ownerId)) return await new ExpenseReportController().postOwnUnderExamination(body, request)
            if (user.access['examine/expenseReport'])
              return await new ExpenseReportExamineController().postAnyUnderExamination(body, request)
          }
          throw new ValidationClientError('Not allowed to submit this report for review')
        },
        { mutation: true }
      )
  )
  if (user.access['examine/expenseReport']) {
    server.registerTool(
      'create_expense_report_for_user',
      {
        title: 'Create an expense report for another user',
        inputSchema: expenseReportSchema.omit({ _id: true }).extend({ ownerId: objectIdSchema }),
        annotations: writeAnnotations
      },
      async (input) =>
        execute(
          async () => {
            const { ownerId, ...body } = input
            return await new ExpenseReportExamineController().postBackInWork(
              { ...body, owner: ownerId } as unknown as Parameters<ExpenseReportExamineController['postBackInWork']>[0],
              request
            )
          },
          { mutation: true }
        )
    )
  }
  if (user.access['examine/travel'] || user.access['examine/expenseReport']) {
    server.registerTool(
      'update_report_for_user',
      {
        title: 'Update a report for another user',
        description: "Update basic fields of a travel or expense report within the caller's supervised projects.",
        inputSchema: z.object({
          reportType: z.enum(['travel', 'expenseReport']),
          reportId: objectIdSchema,
          name: z.string().trim().min(1).optional(),
          project: referenceSchema.optional(),
          advances: z.array(referenceSchema).optional()
        }),
        annotations: writeAnnotations
      },
      async (input) =>
        execute(
          async () => {
            const { reportType, reportId, ...fields } = input
            const ownerId = await getReportOwner(reportType, reportId)
            if (isOwn(user, ownerId)) throw new ValidationClientError('Use the normal own-report tool for this report')
            const body = { _id: reportId, ...fields }
            if (reportType === 'travel' && user.access['examine/travel']) {
              return await new TravelExamineController().postAny(body as Parameters<TravelExamineController['postAny']>[0], request)
            }
            if (reportType === 'expenseReport' && user.access['examine/expenseReport']) {
              return await new ExpenseReportExamineController().postAny(
                body as Parameters<ExpenseReportExamineController['postAny']>[0],
                request
              )
            }
            throw new ValidationClientError('Not allowed to update this report')
          },
          { mutation: true }
        )
    )
  }
  if (user.access['examine/travel'] || user.access['examine/expenseReport']) {
    server.registerTool(
      'set_report_review_state',
      {
        title: 'Change a report review state',
        description: 'Start or complete review, or return a report to its previous editable state.',
        inputSchema: z.object({
          reportType: z.enum(['travel', 'expenseReport']),
          reportId: objectIdSchema,
          action: z.enum(['start_review', 'complete_review', 'return_to_owner', 'return_to_approved']),
          comment: commentSchema,
          bookingRemark: z.string().trim().optional().nullable()
        }),
        annotations: destructiveAnnotations
      },
      async (input) =>
        execute(
          async () => {
            const body = { _id: input.reportId, comment: input.comment }
            if (input.reportType === 'travel' && user.access['examine/travel']) {
              const controller = new TravelExamineController()
              if (input.action === 'start_review') return await controller.postAnyUnderExamination(body, request)
              if (input.action === 'complete_review')
                return await controller.postReviewCompleted({ ...body, bookingRemark: input.bookingRemark }, request)
              if (input.action === 'return_to_approved') return await controller.postAnyApproved(body, request)
            }
            if (input.reportType === 'expenseReport' && user.access['examine/expenseReport']) {
              const controller = new ExpenseReportExamineController()
              if (input.action === 'start_review') return await controller.postAnyUnderExamination(body, request)
              if (input.action === 'complete_review')
                return await controller.postReviewCompleted({ ...body, bookingRemark: input.bookingRemark }, request)
              if (input.action === 'return_to_owner') return await controller.postBackInWork(body, request)
            }
            throw new ValidationClientError(`Action '${input.action}' is not valid for ${input.reportType}`)
          },
          { mutation: true }
        )
    )
  }

  for (const [type, toolType, access] of [
    ['travel', 'travel', 'book/travel'],
    ['advance', 'advance', 'book/advance'],
    ['expenseReport', 'expense_report', 'book/expenseReport']
  ] as const) {
    if (!user.access[access]) continue
    const controller =
      type === 'travel'
        ? new TravelBookableController()
        : type === 'advance'
          ? new AdvanceBookableController()
          : new ExpenseReportBookableController()
    server.registerTool(
      `preview_${toolType}_booking_export`,
      {
        title: `Preview ${type} booking export`,
        inputSchema: z.object({ reportIds: z.array(objectIdSchema).min(1) }),
        annotations: readAnnotations
      },
      async (input) => execute(async () => await controller.postBookingExportPreview(input.reportIds, request))
    )
    server.registerTool(
      `create_${toolType}_booking_export`,
      {
        title: `Create ${type} booking export`,
        inputSchema: z.object({
          reportIds: z.array(objectIdSchema).min(1),
          executionDate: z.iso.date(),
          bankAccounts: z.array(z.object({ organisation: objectIdSchema, account: objectIdSchema }))
        }),
        annotations: destructiveAnnotations
      },
      async (input) =>
        execute(
          async () =>
            await controller.postBookingExportPackage(
              { reports: input.reportIds, executionDate: input.executionDate, bankAccounts: input.bankAccounts },
              request
            ),
          { mutation: true }
        )
    )
    server.registerTool(
      `mark_${toolType}_reports_booked`,
      {
        title: `Mark ${type} reports booked`,
        inputSchema: z.object({ reportIds: z.array(objectIdSchema).min(1) }),
        annotations: destructiveAnnotations
      },
      async (input) => execute(async () => await controller.postBooked(input.reportIds, request), { mutation: true })
    )
  }

  server.registerTool(
    'get_report_pdf',
    {
      title: 'Get report PDF',
      inputSchema: z.object({ reportType: reportTypeSchema, reportId: objectIdSchema }),
      annotations: readAnnotations
    },
    async (input) => {
      try {
        const ownerId = await getReportOwner(input.reportType, input.reportId)
        let readable: Readable
        if (isOwn(user, ownerId)) {
          readable =
            input.reportType === 'travel'
              ? await new TravelController().getOwnReport(input.reportId, request)
              : input.reportType === 'advance'
                ? await new AdvanceController().getReportForOwn(input.reportId, request)
                : await new ExpenseReportController().getReportForOwn(input.reportId, request)
        } else if (input.reportType === 'travel' && user.access['examine/travel']) {
          readable = await new TravelExamineController().getReport(input.reportId, request)
        } else if (input.reportType === 'advance' && user.access['approve/advance']) {
          readable = await new AdvanceApproveController().getReportForAny(input.reportId, request)
        } else if (input.reportType === 'expenseReport' && user.access['examine/expenseReport']) {
          readable = await new ExpenseReportExamineController().getReport(input.reportId, request)
        } else if (input.reportType === 'travel' && user.access['book/travel']) {
          readable = await new TravelBookableController().getBookableReport(input.reportId, request)
        } else if (input.reportType === 'advance' && user.access['book/advance']) {
          readable = await new AdvanceBookableController().getBookableReport(input.reportId, request)
        } else if (input.reportType === 'expenseReport' && user.access['book/expenseReport']) {
          readable = await new ExpenseReportBookableController().getBookableReport(input.reportId, request)
        } else {
          throw new ValidationClientError('Not allowed to read this report PDF')
        }
        const data = await readableToBuffer(readable)
        return {
          content: [
            {
              type: 'resource' as const,
              resource: {
                uri: `abrechnung://reports/${input.reportType}/${input.reportId}.pdf`,
                mimeType: 'application/pdf',
                blob: data.toString('base64')
              }
            }
          ]
        }
      } catch (error) {
        return failure(error)
      }
    }
  )
  server.registerTool(
    'get_document',
    { title: 'Get receipt document', inputSchema: z.object({ documentId: objectIdSchema }), annotations: readAnnotations },
    async (input) => {
      try {
        const file = await DocumentFile.findById(input.documentId, { name: 1, type: 1, owner: 1 }).lean()
        if (!file) throw new ValidationClientError('Document not found')
        const readable = user._id.equals(file.owner)
          ? await new DocumentFileController().getOwn(input.documentId, request)
          : hasAnyAccess(user, ['examine/travel', 'examine/expenseReport'])
            ? await new DocumentFileAdminController().getAny(input.documentId)
            : undefined
        if (!readable) throw new ValidationClientError('Not allowed to read this document')
        const data = await readableToBuffer(readable)
        return {
          content: [
            {
              type: 'resource' as const,
              resource: { uri: `abrechnung://documents/${input.documentId}`, mimeType: file.type, blob: data.toString('base64') }
            }
          ]
        }
      } catch (error) {
        return failure(error)
      }
    }
  )

  return server
}
