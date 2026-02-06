import type { mongo, Types } from 'mongoose'
import { DocumentFileType, documentFileTypes, ImageType, imageTypes } from './utils/file.js'
export { documentFileTypes, imageTypes }
export type { DocumentFileType, ImageType }

/**
 * @pattern ^[0-9a-fA-F]{24}$
 */
export type _id = string | Types.ObjectId
export type binary = mongo.Binary | Blob

export type IdDocument<idType = _id> = idType | { _id: idType }

export function idDocumentToId<idType>(doc: IdDocument<idType>): idType {
  return doc ? (doc as { _id: idType })._id || (doc as idType) : doc
}

/**
 * @pattern /^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/
 */
export type HexColor = string

export const webhookMethods = ['POST', 'PUT', 'PATCH'] as const
export type WebhookMethod = (typeof webhookMethods)[number]

export type Webhook<idType extends _id = _id> = {
  name: string
  executionOrder: number
  reportType: ReportType[]
  onState: (AnyState | 35 | 45)[]
  script?: string | null
  isActive: boolean
  request: {
    url: string
    headers: { [key: string]: string }
    method: WebhookMethod
    convertBodyToFormData: boolean
    pdfFormFieldName?: string | null
    body?: unknown
  }
  _id: idType
}

export interface Settings<idType extends _id = _id> {
  userCanSeeAllProjects: boolean
  onlyShowProjectNamesOnAssigned: boolean
  autoSelectAvailableAdvances: boolean
  preventOwnersFromDeletingReportsAfterReviewCompleted: boolean
  defaultAccess: { [key in Access]: boolean }
  disableReportType: { [key in ReportType]: boolean }
  retentionPolicy: {
    [key in RetentionType]: number
  }
  uploadTokenExpireAfterSeconds: number
  isReadOnly: boolean
  version: string
  /**
   * @Hidden
   */
  migrateFrom?: string | null
  _id: idType
}

export interface TravelSettings<idType extends _id = _id> {
  maxTravelDayCount: number
  allowSpouseRefund: boolean
  allowTravelApplicationForThePast: boolean
  toleranceStageDatesToApprovedTravelDates: number
  distanceRefunds: { [key in DistanceRefundType]: number }
  vehicleRegistrationWhenUsingOwnCar: 'required' | 'optional' | 'none'
  defaultLastPlaceOfWork: DefaultLastPlaceOfWorkSetting
  lumpSumCut: { [key in Meal]: number }
  factorCateringLumpSum: number
  factorCateringLumpSumExceptions: CountryCode[]
  factorOvernightLumpSum: number
  factorOvernightLumpSumExceptions: CountryCode[]
  fallbackLumpSumCountry: CountryCode
  secondNightOnAirplaneLumpSumCountry: CountryCode
  secondNightOnShipOrFerryLumpSumCountry: CountryCode
  minHoursOfTravel: number
  minProfessionalShare: number
  _id: idType
}

export interface ldapauthSettings {
  url: string
  bindDN: string
  bindCredentials: string
  searchBase: string
  searchFilter: string
  tlsOptions: { rejectUnauthorized: boolean }
  mailAttribute: string
  uidAttribute: string
  familyNameAttribute: string
  givenNameAttribute: string
}

export const smtpAuthTypes = ['Login', 'OAuth2'] as const
export type SMTPAuthType = (typeof smtpAuthTypes)[number]

export interface smtpSettings {
  host: string
  port: number
  secure: boolean
  auth:
    | { authType: 'Login'; user: string; pass: string }
    | {
        authType: 'OAuth2'
        user?: string
        clientId?: string
        clientSecret?: string
        refreshToken?: string
        accessUrl?: string
        accessToken?: string
        privateKey?: string // | { key: string; passphrase: string }
        expires?: number
        timeout?: number
        serviceClient?: string
      }
  senderAddress: string
}

export interface microsoftSettings {
  clientId: string
  clientSecret: string
  tenant: string
}

export interface oidcSettings {
  server: string // Authorization server's Issuer Identifier URL
  clientId: string // Client identifier at the Authorization Server
  clientSecret: string // Client Secret
}

export interface ConnectionSettings<idType extends _id = _id> {
  PDFReportsViaEmail: { sendPDFReportsToOrganisationEmail: boolean; locale: Locale }
  auth: { microsoft?: microsoftSettings | null; ldapauth?: ldapauthSettings | null; oidc?: oidcSettings | null }
  smtp?: smtpSettings | null

  _id: idType
}

export interface DisplaySettings<idType extends _id = _id> {
  auth: { magiclogin: boolean; microsoft: boolean; ldapauth: boolean; oidc: boolean }
  oidc: { label: string; icon: string }
  locale: { default: Locale; fallback: Locale; overwrite: { [key in Locale]: { [key: string]: string } } }
  nameDisplayFormat: NameDisplayFormat
  helpButton: {
    enabled: boolean
    examinersMail: boolean
    examinersMsTeams: boolean
    customOptions: { label: string; link: string; icon: string }[]
  }
  stateColors: { [key in AnyState]: BadgeStyle }
  accessIcons: { [key in Access]: string[] }
  reportTypeIcons: { [key in ReportType]: string[] }
  _id: idType
}

export interface PrinterSettings<idType extends _id = _id> extends PrintSettingsBase {
  fontName: FontName
  _id: idType
}

export interface PrintSettingsBase {
  fontSizes: { S: number; M: number; L: number }
  textColor: HexColor
  pagePadding: number
  borderColor: HexColor
  borderThickness: number
  cellPadding: { x: number; bottom: number }
  pageSize: { width: number; height: number }
  options: { [key in ReportType]: PrintOptions }
}

export interface PrintOptions {
  reviewDates: boolean
  metaInformation: boolean
  project: boolean
  comments: boolean
  notes: boolean
  bookingRemark: boolean
}

export interface BadgeStyle {
  color: HexColor
  text: TextColor
}

export interface Category<idType extends _id = _id> {
  name: string
  style: BadgeStyle
  isDefault: boolean
  _id: idType
}

/**
 * @pattern ^[A-Z]{2}$
 */
export type CountryCode = string

export interface CountrySimple {
  _id: CountryCode
  name: { [key in Locale]: string }
  needsA1Certificate?: boolean | null
  alias?: { [key in Locale]?: string[] }
  flag?: string | null
  currency?: CurrencyCode | null
}

export interface LumpSumWithSpecials extends LumpSum {
  specials?: ({ city: string } & LumpSum)[]
}

export interface CountryLumpSum extends LumpSumWithSpecials {
  validFrom: Date | string
  validUntil: Date | string | null
}

export interface Country extends CountrySimple {
  lumpSums: CountryLumpSum[]
  lumpSumsFrom?: string | null
}

export interface ExchangeRate {
  currency: string
  value: number
  year: number
  month: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
}

/**
 * @pattern ^[A-Z]{3}$
 */
export type CurrencyCode = string

export interface Currency {
  name: { [key in Locale]: string }
  _id: CurrencyCode
  subunit?: string | null
  symbol?: string | null
  flag?: string | null
}

export interface Place {
  place: string
  country: CountrySimple
  special?: string
}

export interface DocumentFile<idType extends _id = _id, dataType extends binary = binary, T extends DocumentFileType = DocumentFileType> {
  data: dataType
  owner: idType
  type: T
  name: string
  _id: idType
}

export interface Token<idType extends _id = _id, dataType extends binary = binary> {
  _id: idType
  expireAt: Date | string
  files: DocumentFile<idType, dataType>[]
}

export interface Contact {
  email: string
  name: Name
}

export interface Name {
  givenName: string
  familyName: string
}

export interface UserSimple<idType extends _id = _id> extends Contact {
  _id: idType
}

export interface HealthInsurance<idType extends _id = _id> {
  name: string
  email: string
  _id: idType
}

export interface OrganisationSimple<idType extends _id = _id> {
  name: string
  _id: idType
}

export interface ProjectSimple<idType extends _id = _id> {
  identifier: string
  organisation: idType
  _id: idType
}

export interface ProjectSimpleWithName<idType extends _id = _id> extends ProjectSimple<idType> {
  name?: string
}

export interface Project<idType extends _id = _id> extends ProjectSimpleWithName<idType> {
  balance: BaseCurrencyMoneyNotNull
  budget?: BaseCurrencyMoney
}

export interface ProjectUsers<idType extends _id = _id> {
  assignees: idType[]
  supervisors: idType[]
}

export interface ProjectWithUsers<idType extends _id = _id> extends Project<idType>, ProjectUsers<idType> {}

export interface Organisation<idType extends _id = _id, dataType extends binary = binary> extends OrganisationSimple<idType> {
  subfolderPath: string
  reportEmail?: string | null
  a1CertificateEmail?: string | null
  bankDetails?: string | null
  companyNumber?: string | null
  logo?: DocumentFile<idType, dataType, ImageType> | null
  website?: string | null
}

export interface User<idType extends _id = _id, dataType extends binary = binary> extends UserSimple<idType> {
  fk: { microsoft?: string | null; ldapauth?: string | null; magiclogin?: string | null; oidc?: string | null; httpBearer?: string | null }
  access: {
    [key in Access]: boolean
  }
  projects: UserProjects<idType>
  loseAccessAt?: null | Date | string
  settings: {
    language: Locale
    hasUserSetLanguage: boolean
    lastCurrencies: Currency[]
    lastCountries: CountrySimple[]
    insurance?: HealthInsurance<idType> | null
    organisation?: OrganisationSimple<idType> | null
    showInstallBanner: boolean
  }
  vehicleRegistration?: DocumentFile<idType, dataType>[] | null
  token?: Token<idType, dataType> | null
}

export interface UserWithName<idType extends _id = _id> {
  _id: idType
  name: Name
}

export interface UserSimpleWithProject<idType extends _id = _id> extends UserSimple<idType> {
  projects: UserProjects<idType>
}

interface UserProjects<idType extends _id = _id> {
  assigned: Project<idType>[]
  supervised: idType[]
}

export const tokenAdminUser = {
  fk: { magiclogin: 'admin@to.ken' },
  email: 'admin@to.ken',
  name: { familyName: 'Token Access', givenName: 'Admin' },
  access: { user: true, admin: true },
  isActive: async () => true
}

export interface BaseCurrencyMoneyNotNull extends BaseCurrencyMoney {
  amount: number
}
export interface BaseCurrencyMoney {
  amount: number | null
}

export interface Money extends BaseCurrencyMoney {
  currency: Currency
  exchangeRate?: { date: Date | string; rate: number; amount: number } | null
}
export interface MoneyNotNull extends Money {
  amount: number
}

export interface MoneyPlus<idType extends _id = _id, dataType extends binary = binary> extends Money {
  receipts?: DocumentFile<idType, dataType>[] | null
  date?: Date | string | null
}

export interface Cost<idType extends _id = _id, dataType extends binary = binary> extends MoneyPlus<idType, dataType> {
  receipts: DocumentFile<idType, dataType>[]
  date: Date | string
}

export interface Stage<idType extends _id = _id, dataType extends binary = binary> {
  departure: Date | string
  arrival: Date | string
  startLocation: Place
  endLocation: Place
  midnightCountries?: { date: Date | string; country: CountrySimple }[] | null
  transport: Transport
  cost: Cost<idType, dataType>
  purpose: Purpose
  project?: ProjectSimple<idType> | null
  note?: string | null
  _id: idType
}

export interface Expense<idType extends _id = _id, dataType extends binary = binary> {
  description: string
  cost: Cost<idType, dataType>
  project?: ProjectSimple<idType> | null
  note?: string | null
  _id: idType
}

export interface TravelExpense<idType extends _id = _id, dataType extends binary = binary> extends Expense<idType, dataType> {
  purpose: 'professional' | 'mixed'
}

export type TravelRecordType = 'stage' | 'expense'
export type TravelRecord<idType extends _id = _id, dataType extends binary = binary> =
  | Stage<idType, dataType>
  | TravelExpense<idType, dataType>

export interface Comment<idType extends _id = _id, State extends AnyState = AnyState> {
  text: string
  author: UserSimple<idType>
  toState: State
  _id: idType
}

export type Transport =
  | { type: (typeof transportTypesButOwnCar)[number] }
  | { type: 'ownCar'; distance: number; distanceRefundType: DistanceRefundType }

export interface TravelDayFullCountry<idType extends _id = _id> extends Omit<TravelDay<idType>, 'country'> {
  country: Country
}

export interface TravelDay<idType extends _id = _id> {
  date: Date | string
  country: CountrySimple
  special?: string
  cateringRefund: {
    [key in Meal]: boolean
  }
  overnightRefund: boolean
  purpose: PurposeSimple
  lumpSums: { overnight: { refund: BaseCurrencyMoneyNotNull }; catering: { refund: BaseCurrencyMoneyNotNull; type: CateringType } }
  _id: idType
}

export type Log<idType extends _id = _id, S extends AnyState = AnyState> = {
  [key in S]?: { on: Date | string; by: UserSimple<idType> }
}

export interface ReportSimple<idType extends _id = _id, S extends AnyState = AnyState> {
  name: string
  reference: number
  owner: UserSimple<idType>
  editor: UserSimple<idType>
  project: Project<idType>
  comment?: string | null
  bookingRemark?: string | null
  comments: Comment<idType, S>[]
  state: S
  log: Log<idType, S>
  createdAt: Date | string
  updatedAt: Date | string
  _id: idType
}

export interface Report<idType extends _id = _id, S extends AnyState = AnyState> extends ReportSimple<idType, S> {
  history: idType[]
  historic: boolean
}

export interface AdvanceBase<idType extends _id = _id> {
  name: string
  budget: MoneyNotNull
  project: Project<idType>
  balance: BaseCurrencyMoneyNotNull
  reason: string
  state: AdvanceState
  receivedOn?: Date | string | null
  settledOn?: Date | string | null
  _id: idType
}

export interface AdvanceSimple<idType extends _id = _id> extends ReportSimple<idType, AdvanceState>, AdvanceBase<idType> {
  offsetAgainst: { type: ReportModelNameWithoutAdvance | 'offsetEntry'; reportId?: idType | null; subject: string; amount: number }[]
}

export interface Advance<idType extends _id = _id> extends Report<idType, AdvanceState>, AdvanceSimple<idType> {}

interface TravelBase {
  reason: string
  destinationPlace: Omit<Place, 'special'>
  startDate: Date | string
  endDate: Date | string
  claimSpouseRefund?: boolean | null //travelSettings.allowSpouseRefund
  fellowTravelersNames?: string | null //travelSettings.allowSpouseRefund
}

export interface TravelSimple<idType extends _id = _id> extends TravelBase, ReportSimple<idType, TravelState> {
  progress: number
  addUp: AddUp<idType, Travel<_id, binary>>[]
  advances: AdvanceBase<idType>[]
  isCrossBorder?: boolean | null
  a1Certificate?: { exactAddress: string; destinationName: string } | null
}

export interface Travel<idType extends _id = _id, dataType extends binary = binary>
  extends TravelSimple<idType>,
    Report<idType, TravelState> {
  lastPlaceOfWork?: Omit<Place, 'place'> | null
  professionalShare: number | null
  stages: Stage<idType, dataType>[]
  expenses: TravelExpense<idType, dataType>[]
  days: TravelDay<idType>[]
}

export interface ExpenseReportSimple<idType extends _id = _id> extends ReportSimple<idType, ExpenseReportState> {
  addUp: AddUp<idType, ExpenseReport<_id, binary>>[]
  advances: AdvanceBase<idType>[]
  category: Category<idType>
}
export interface ExpenseReport<idType extends _id = _id, dataType extends binary = binary>
  extends ExpenseReportSimple<idType>,
    Report<idType, ExpenseReportState> {
  expenses: Expense<idType, dataType>[]
}

export interface HealthCareCostSimple<idType extends _id = _id> extends ReportSimple<idType, HealthCareCostState> {
  patientName: string
  insurance: HealthInsurance<idType>
  addUp: AddUp<idType, HealthCareCost<_id, binary>>[]
  advances: AdvanceBase<idType>[]
}
export interface HealthCareCost<idType extends _id = _id, dataType extends binary = binary>
  extends HealthCareCostSimple<idType>,
    Report<idType, HealthCareCostState> {
  expenses: Expense<idType, dataType>[]
}

export interface ApprovedTravel<idType extends _id = _id> extends TravelBase {
  traveler: string
  reportId?: idType
  organisationId: idType
  appliedForOn: Date | string
  approvedBy: string
  approvedOn: Date | string
}

export interface ReportUsage<idType extends _id = _id> {
  reportId: idType
  reference: number
  reportModelName: ReportModelName
  organisationId: idType
  projectId: idType
  createdAt: Date | string
  updatedAt: Date | string
}

export const State = { REJECTED: -10, APPLIED_FOR: 0, EDITABLE_BY_OWNER: 10, IN_REVIEW: 20, BOOKABLE: 30, BOOKED: 40 } as const

export enum TravelState {
  REJECTED = -10, //State.REJECTED
  APPLIED_FOR = 0, //State.APPLIED_FOR
  APPROVED = 10, //State.EDITABLE_BY_OWNER
  IN_REVIEW = 20, //State.IN_REVIEW
  REVIEW_COMPLETED = 30, //State.BOOKABLE
  BOOKED = 40 //State.BOOKED
}
export type TravelStateStrings = keyof typeof TravelState
export const travelStates = Object.values(TravelState).filter((v) => typeof v === 'number')

export enum AdvanceState {
  REJECTED = -10, //State.REJECTED
  APPLIED_FOR = 0, //State.APPLIED_FOR,
  APPROVED = 30, //State.BOOKABLE,
  BOOKED = 40 //State.BOOKED
}
export type AdvanceStateStrings = keyof typeof AdvanceState
export const advanceStates = Object.values(AdvanceState).filter((v) => typeof v === 'number')

export enum ExpenseReportState {
  IN_WORK = 10, //State.EDITABLE_BY_OWNER
  IN_REVIEW = 20, //State.IN_REVIEW
  REVIEW_COMPLETED = 30, //State.BOOKABLE
  BOOKED = 40 //State.BOOKED
}
export type ExpenseReportStateStrings = keyof typeof ExpenseReportState
export const expenseReportStates = Object.values(ExpenseReportState).filter((v) => typeof v === 'number')

export enum HealthCareCostState {
  IN_WORK = 10, //State.EDITABLE_BY_OWNER
  IN_REVIEW = 20, //State.IN_REVIEW
  REVIEW_COMPLETED = 30, //State.BOOKABLE
  BOOKED = 40 //State.BOOKED
}
export type HealthCareCostStateStrings = keyof typeof HealthCareCostState
export const healthCareCostStates = Object.values(HealthCareCostState).filter((v) => typeof v === 'number')

export const locales = ['de', 'en', 'fr', 'ru', 'es', 'kk'] as const
export type Locale = (typeof locales)[number]

export const anyStates = new Set([...travelStates, ...expenseReportStates, ...healthCareCostStates, ...advanceStates])
export type AnyState = TravelState | HealthCareCostState | ExpenseReportState | AdvanceState
export type AnyStateEnum = typeof TravelState | typeof HealthCareCostState | typeof ExpenseReportState | typeof AdvanceState

const transportTypesButOwnCar = ['airplane', 'shipOrFerry', 'otherTransport'] as const
export const transportTypes = ['ownCar', ...transportTypesButOwnCar] as const
export type TransportType = (typeof transportTypes)[number]

export const distanceRefundTypes = ['car', 'motorcycle', 'halfCar'] as const
export type DistanceRefundType = (typeof distanceRefundTypes)[number]

export const reportModelNamesWithoutAdvance = ['Travel', 'ExpenseReport', 'HealthCareCost'] as const
export type ReportModelNameWithoutAdvance = (typeof reportModelNamesWithoutAdvance)[number]

export const reportModelNames = [...reportModelNamesWithoutAdvance, 'Advance'] as const
export type ReportModelName = (typeof reportModelNames)[number]

export const reportTypes = ['travel', 'expenseReport', 'healthCareCost', 'advance'] as const
export type ReportType = (typeof reportTypes)[number]

export const nameDisplayFormats = ['givenNameFirst', 'familyNameFirst'] as const
export type NameDisplayFormat = (typeof nameDisplayFormats)[number]

export const defaultLastPlaceOfWorkSettings = ['destinationPlace', 'lastEndLocation'] as const
export type DefaultLastPlaceOfWorkSetting = (typeof defaultLastPlaceOfWorkSettings)[number]

export function getReportTypeFromModelName(modelName: ReportModelName): ReportType {
  switch (modelName) {
    case 'Travel':
      return 'travel'
    case 'ExpenseReport':
      return 'expenseReport'
    case 'HealthCareCost':
      return 'healthCareCost'
    case 'Advance':
      return 'advance'
  }
}

export function getReportModelNameFromType(reportType: ReportType): ReportModelName {
  switch (reportType) {
    case 'travel':
      return 'Travel'
    case 'expenseReport':
      return 'ExpenseReport'
    case 'healthCareCost':
      return 'HealthCareCost'
    case 'advance':
      return 'Advance'
  }
}

export function getStateEnumFromModelName(modelName: ReportModelName): AnyStateEnum {
  switch (modelName) {
    case 'Travel':
      return TravelState
    case 'ExpenseReport':
      return ExpenseReportState
    case 'HealthCareCost':
      return HealthCareCostState
    case 'Advance':
      return AdvanceState
  }
}
export function getModelNameFromReport(report: Travel | ExpenseReport | HealthCareCost | Advance): ReportModelName
// biome-ignore lint/suspicious/noExplicitAny: generic type is needed for type guard
export function getModelNameFromReport(report: any): ReportModelName {
  if (reportIsTravel(report)) {
    return 'Travel'
  } else if (reportIsHealthCareCost(report)) {
    return 'HealthCareCost'
  } else if (reportIsAdvance(report)) {
    return 'Advance'
  } else {
    return 'ExpenseReport'
  }
}

export const retention = [
  'deleteBookedAfterXDays',
  'deleteApprovedTravelAfterXDaysUnused',
  'deleteInWorkReportsAfterXDaysUnused',
  'mailXDaysBeforeDeletion'
] as const
export type RetentionType = (typeof retention)[number]

export const accesses = [
  'user',
  'inWork:expenseReport',
  'inWork:healthCareCost',
  'appliedFor:advance',
  'appliedFor:travel',
  'approved:travel',
  'approve/advance',
  'approve/travel',
  'examine/travel',
  'examine/expenseReport',
  'examine/healthCareCost',
  'book/advance',
  'book/travel',
  'book/expenseReport',
  'book/healthCareCost',
  'admin'
] as const
export type Access = (typeof accesses)[number]

export const meals = ['breakfast', 'lunch', 'dinner'] as const
export type Meal = (typeof meals)[number]

export const fontNames = ['NotoSans', 'Inter'] as const
export type FontName = (typeof fontNames)[number]

export type PageOrientation = 'portrait' | 'landscape'

export const cateringTypes = ['catering8', 'catering24'] as const
export type CateringType = (typeof cateringTypes)[number]

export const lumpsumTypes = ['overnight', ...cateringTypes] as const
export type LumpsumType = (typeof lumpsumTypes)[number]
export type LumpSum = { [key in LumpsumType]: number }

export const textColors = ['black', 'white'] as const
export type TextColor = (typeof textColors)[number]

export type PurposeSimple = 'professional' | 'private'

export type Purpose = PurposeSimple | 'mixed'

export interface Meta {
  count: number
  page: number
  limit: number
  countPages: number
}

export interface GETResponse<T> {
  data: T
  meta: Meta
}

export interface SETResponse<T> {
  message: string
  result: T
}

export const userReplaceCollections = ['travels', 'expensereports', 'healthcarecosts', 'advances'] as const
export type UserReplaceReferencesResult = {
  [key in (typeof userReplaceCollections)[number] | 'documentfiles']?: { matchedCount: number; modifiedCount: number }
}

export function reportIsTravel(
  report: Travel<_id, binary> | ExpenseReport<_id, binary> | HealthCareCost<_id, binary> | Advance<_id>
): report is Travel<_id, binary>
export function reportIsTravel(
  report: TravelSimple<_id> | ExpenseReportSimple<_id> | HealthCareCostSimple<_id> | Advance<_id>
): report is TravelSimple<_id>
export function reportIsTravel(report: AddUpTravel | AddUpReport): report is AddUpTravel
// biome-ignore lint/suspicious/noExplicitAny: generic type is needed for type guard
export function reportIsTravel(report: any): report is { startDate: Date | string } {
  return typeof report.startDate === 'string' || report.startDate instanceof Date
}

export function reportIsHealthCareCost(
  report: Travel<_id, binary> | ExpenseReport<_id, binary> | HealthCareCost<_id, binary> | Advance<_id>
): report is HealthCareCost<_id, binary>
export function reportIsHealthCareCost(
  report: TravelSimple<_id> | ExpenseReportSimple<_id> | HealthCareCostSimple<_id> | Advance<_id>
): report is HealthCareCostSimple<_id>
// biome-ignore lint/suspicious/noExplicitAny: generic type is needed for type guard
export function reportIsHealthCareCost(report: any): report is { patientName: string } {
  return typeof report.patientName === 'string'
}

export function reportIsAdvance(
  report: Travel<_id, binary> | ExpenseReport<_id, binary> | HealthCareCost<_id, binary> | Advance<_id>
): report is Advance<_id>
export function reportIsAdvance(
  report: TravelSimple<_id> | ExpenseReportSimple<_id> | HealthCareCostSimple<_id> | Advance<_id>
): report is Advance<_id>
// biome-ignore lint/suspicious/noExplicitAny: generic type is needed for type guard
export function reportIsAdvance(report: any): report is { startDate: Exclude<unknown, Date | string>; reason: string } {
  return !reportIsTravel(report) && typeof report.reason === 'string'
}

export function reportIsExpenseReport(
  report: Travel<_id, binary> | ExpenseReport<_id, binary> | HealthCareCost<_id, binary> | Advance<_id>
): report is ExpenseReport<_id, binary>
export function reportIsExpenseReport(
  report: TravelSimple<_id> | ExpenseReportSimple<_id> | HealthCareCostSimple<_id> | Advance<_id>
): report is ExpenseReportSimple<_id>
// biome-ignore lint/suspicious/noExplicitAny: generic type is needed for type guard
export function reportIsExpenseReport(report: any): report is any {
  return !reportIsTravel(report) && !reportIsAdvance(report) && !reportIsHealthCareCost(report)
}

type AddUpBase<idType extends _id = _id> = {
  project: ProjectSimple<idType>
  balance: BaseCurrencyMoneyNotNull
  total: BaseCurrencyMoneyNotNull
  advance: BaseCurrencyMoneyNotNull
  expenses: BaseCurrencyMoneyNotNull
  advanceOverflow: boolean
}

export interface AddUpTravel {
  expenses: Travel['expenses']
  stages: Travel['stages']
  days: Travel['days']
  professionalShare: Travel['professionalShare']
  project: (ExpenseReport | HealthCareCost)['project']
  advances: Travel['advances']
  startDate: Travel['startDate']
}
export interface AddUpReport {
  expenses: (ExpenseReport | HealthCareCost)['expenses']
  advances: (ExpenseReport | HealthCareCost)['advances']
  project: (ExpenseReport | HealthCareCost)['project']
}

export type AddUp<idType extends _id = _id, T extends AddUpTravel | AddUpReport = AddUpTravel | AddUpReport> = T extends AddUpTravel
  ? AddUpBase<idType> & { lumpSums: BaseCurrencyMoneyNotNull }
  : AddUpBase<idType>

export type FlatAddUp<idType extends _id = _id, T extends AddUpTravel | AddUpReport = AddUpTravel | AddUpReport> =
  | AddUp<idType, T>
  | (Omit<AddUp<idType, T>, 'project'> & { project: idType })

export const emailRegex =
  /([-!#-'*+/-9=?A-Z^-~]+(\.[-!#-'*+/-9=?A-Z^-~]+)*|"(!#-[^-~ \t]|(\\[\t -~]))+")@[0-9A-Za-z]([0-9A-Za-z-]{0,61}[0-9A-Za-z])?(\.[0-9A-Za-z]([0-9A-Za-z-]{0,61}[0-9A-Za-z])?)+/

export const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const hexColorRegex = /^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/

export const refStringRegex = /^[TEHA](-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{3})+$/
export const refStringRegexLax = /^[TEHA](-[0123456789ABCDEFGHJKMNPQRSTVWXYZILO]{3})+$/i

export const baseCurrency: Currency = {
  _id: 'EUR',
  name: { de: 'Euro', en: 'euro', fr: 'euro', es: 'euro', ru: 'евро', kk: 'Еуро' },
  subunit: 'Cent',
  symbol: '€',
  flag: '🇪🇺'
}
export const defaultLocale: Locale = 'de'
