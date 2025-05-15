import { Types, mongo } from 'mongoose'

/**
 * @pattern ^[0-9a-fA-F]{24}$
 */
export type _id = Types.ObjectId

/**
 * @pattern /^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/
 */
export type HexColor = string

export interface Settings {
  userCanSeeAllProjects: boolean
  defaultAccess: { [key in Access]: boolean }
  disableReportType: { [key in ReportType]: boolean }
  retentionPolicy: {
    [key in RetentionType]: number
  }
  uploadTokenExpireAfterSeconds: number
  version: string
  /**
   * @Hidden
   */
  migrateFrom?: string | null
  _id: _id
}

export interface TravelSettings {
  maxTravelDayCount: number
  allowSpouseRefund: boolean
  allowTravelApplicationForThePast: boolean
  toleranceStageDatesToApprovedTravelDates: number
  distanceRefunds: { [key in DistanceRefundType]: number }
  vehicleRegistrationWhenUsingOwnCar: 'required' | 'optional' | 'none'
  lumpSumCut: { [key in Meal]: number }
  factorCateringLumpSum: number
  factorCateringLumpSumExceptions: CountryCode[]
  factorOvernightLumpSum: number
  factorOvernightLumpSumExceptions: CountryCode[]
  fallBackLumpSumCountry: CountryCode
  secondNightOnAirplaneLumpSumCountry: CountryCode
  secondNightOnShipOrFerryLumpSumCountry: CountryCode
  minHoursOfTravel: number
  minProfessionalShare: number
  _id: _id
}

export interface ldapauthSettings {
  url: string
  bindDN: string
  bindCredentials: string
  searchBase: string
  searchFilter: string
  tlsOptions: {
    rejectUnauthorized: boolean
  }
  mailAttribute: string
  uidAttribute: string
  familyNameAttribute: string
  givenNameAttribute: string
}

export interface smtpSettings {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
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

export interface ConnectionSettings {
  PDFReportsViaEmail: {
    sendPDFReportsToOrganisationEmail: boolean
    locale: Locale
  }
  auth: {
    microsoft?: microsoftSettings | null
    ldapauth?: ldapauthSettings | null
    oidc?: oidcSettings | null
  }
  smtp?: smtpSettings | null

  _id: _id
}

export interface DisplaySettings {
  auth: {
    magiclogin: boolean
    microsoft: boolean
    ldapauth: boolean
    oidc: boolean
  }
  oidc: {
    label: string
    icon: string
  }
  locale: {
    default: Locale
    fallback: Locale
    overwrite: { [key in Locale]: { [key: string]: string } }
  }
  stateColors: { [key in AnyState]: { color: HexColor; text: string } }
  accessIcons: { [key in Access]: string[] }
  _id: _id
}

export interface PrinterSettings extends PrintSettingsBase {
  fontName: FontName
  _id: _id
}

export interface PrintSettingsBase {
  fontSizes: { S: number; M: number; L: number }
  textColor: HexColor
  pagePadding: number
  borderColor: HexColor
  borderThickness: number
  cellPadding: { x: number; bottom: number }
  pageSize: { width: number; height: number }
}

/**
 * @pattern ^[A-Z]{2}$
 */
export type CountryCode = string

export interface CountrySimple {
  _id: CountryCode
  name: {
    de: string
    en: string
  }
  needsA1Certificate?: boolean | null
  alias?: {
    de: string[]
    en?: string[]
  }
  flag?: string | null
  currency?: CurrencyCode | null
}

export interface CountryLumpSum extends LumpSum {
  validFrom: Date | string
  specials?: ({
    city: string
  } & LumpSum)[]
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
  name: {
    de: string
    en: string
  }
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

export interface DocumentFile<T extends DocumentFileType = DocumentFileType> {
  data: mongo.Binary
  owner: _id
  type: T
  name: string
  _id: _id
}

export interface Token {
  _id: _id
  expireAt: Date | string
  files: DocumentFile[]
}

export interface Contact {
  email: string
  name: { givenName: string; familyName: string }
}

export interface UserSimple extends Contact {
  _id: _id
}

export interface HealthInsurance {
  name: string
  email: string
  _id: _id
}

export interface OrganisationSimple {
  name: string
  _id: _id
}

export interface ProjectSimple {
  identifier: string
  organisation: _id
  _id: _id
}

export interface Project extends ProjectSimple {
  name?: string
  balance: BaseCurrencyMoney
  budget?: BaseCurrencyMoney
}

export interface ProjectUsers {
  assignees: _id[]
  supervisors: _id[]
}

export interface ProjectWithUsers extends Project, ProjectUsers {}

export interface Organisation extends OrganisationSimple {
  subfolderPath: string
  reportEmail?: string | null
  a1CertificateEmail?: string | null
  bankDetails?: string | null
  companyNumber?: string | null
  logo?: DocumentFile<ImageType> | null
  website?: string | null
}

export interface User extends UserSimple {
  fk: {
    microsoft?: string | null
    ldapauth?: string | null
    magiclogin?: string | null
    oidc?: string | null
    httpBearer?: string | null
  }
  access: {
    [key in Access]: boolean
  }
  projects: {
    assigned: Project[]
    supervised: _id[]
  }
  loseAccessAt?: null | Date | string
  settings: {
    language: Locale
    lastCurrencies: Currency[]
    lastCountries: CountrySimple[]
    insurance?: HealthInsurance | null
    organisation?: OrganisationSimple | null
    showInstallBanner: boolean
  }
  vehicleRegistration?: DocumentFile[] | null
  token?: Token | null
}

export const tokenAdminUser: Omit<User, 'access' | 'projects' | 'settings' | '_id'> & {
  access: { user: User['access']['user']; admin: User['access']['admin'] }
} = {
  fk: { magiclogin: 'admin@to.ken' },
  email: 'admin@to.ken',
  name: { familyName: 'Token Access', givenName: 'Admin' },
  access: { user: true, admin: true }
}

export interface BaseCurrencyMoney {
  amount: number | null
}

export interface Money extends BaseCurrencyMoney {
  currency: Currency
  exchangeRate?: {
    date: Date | string
    rate: number
    amount: number
  } | null
}

export interface MoneyPlus extends Money {
  receipts?: DocumentFile[] | null
  date?: Date | string | null
}

export interface Cost extends MoneyPlus {
  receipts: DocumentFile[]
  date: Date | string
}

export interface Stage {
  departure: Date | string
  arrival: Date | string
  startLocation: Place
  endLocation: Place
  midnightCountries?: { date: Date | string; country: CountrySimple }[] | null
  transport: Transport
  cost: Cost
  purpose: Purpose
  note?: string | null
  _id: _id
}

export interface Expense {
  description: string
  cost: Cost
  note?: string | null
  _id: _id
}

export interface TravelExpense extends Expense {
  purpose: 'professional' | 'mixed'
}

export type TravelRecordType = 'stage' | 'expense'
export type TravelRecord = Stage | TravelExpense

export interface Comment<State extends AnyState = AnyState> {
  text: string
  author: UserSimple
  toState: State
  _id: _id
}

export type Transport =
  | { type: (typeof transportTypesButOwnCar)[number] }
  | {
      type: 'ownCar'
      distance: number
      distanceRefundType: DistanceRefundType
    }

export interface Refund {
  type: LumpsumType
  refund: BaseCurrencyMoney
  _id: Types.ObjectId
}

export interface TravelDayFullCountry extends Omit<TravelDay, 'country'> {
  country: Country
}

export interface TravelDay {
  date: Date | string
  country: CountrySimple
  special?: string
  cateringRefund: {
    [key in Meal]: boolean
  }
  overnightRefund: boolean
  purpose: PurposeSimple
  lumpSums: {
    overnight: { refund: BaseCurrencyMoney }
    catering: { refund: BaseCurrencyMoney; type: CateringType }
  }
  _id: _id
}

export type Log<S extends AnyState = AnyState> = {
  [key in S]?: {
    date: Date | string
    editor: UserSimple
  }
}

export interface ReportSimple<S extends AnyState = AnyState> {
  name: string
  owner: UserSimple
  editor: UserSimple
  project: Project
  comment?: string | null
  comments: Comment<S>[]
  state: S
  log: Log<S>
  createdAt: Date | string
  updatedAt: Date | string
  _id: _id
}

export interface Report<S extends AnyState = AnyState> extends ReportSimple<S> {
  history: _id[]
  historic: boolean
}

export interface AdvanceBase {
  name: string
  budget: Money
  balance: BaseCurrencyMoney
  runningBalance: BaseCurrencyMoney
  reason: string
  _id: _id
}

export interface AdvanceSimple extends ReportSimple<AdvanceState>, AdvanceBase {}

export interface Advance extends Report<AdvanceState>, AdvanceSimple {}

export interface TravelSimple extends ReportSimple<TravelState> {
  reason: string
  destinationPlace: Place
  startDate: Date | string
  endDate: Date | string
  progress: number
  addUp: AddUpResult<Travel>
  advances: AdvanceBase[]
  isCrossBorder?: boolean | null
  a1Certificate?: {
    exactAddress: string
    destinationName: string
  } | null
  claimSpouseRefund?: boolean | null //settings.allowSpouseRefund
  fellowTravelersNames?: string | null //settings.allowSpouseRefund
}

export interface Travel extends TravelSimple, Report<TravelState> {
  lastPlaceOfWork: Place
  professionalShare: number | null
  stages: Stage[]
  expenses: TravelExpense[]
  days: TravelDay[]
}

export interface ExpenseReportSimple extends ReportSimple<ExpenseReportState> {
  addUp: AddUpResult<ExpenseReport>
  advances: AdvanceBase[]
}
export interface ExpenseReport extends ExpenseReportSimple, Report<ExpenseReportState> {
  expenses: Expense[]
}

export interface HealthCareCostSimple extends ReportSimple<HealthCareCostState> {
  patientName: string
  insurance: HealthInsurance
  refundSum: MoneyPlus
  addUp: AddUpResult<HealthCareCost>
  advances: AdvanceBase[]
}
export interface HealthCareCost extends HealthCareCostSimple, Report<HealthCareCostState> {
  expenses: Expense[]
}

export const locales = ['de', 'en'] as const
export type Locale = (typeof locales)[number]

export const travelStates = ['rejected', 'appliedFor', 'approved', 'underExamination', 'refunded'] as const
export type TravelState = (typeof travelStates)[number]

export const expenseReportStates = ['inWork', 'underExamination', 'refunded'] as const
export type ExpenseReportState = (typeof expenseReportStates)[number]

export const healthCareCostStates = ['inWork', 'underExamination', 'underExaminationByInsurance', 'refunded'] as const
export type HealthCareCostState = (typeof healthCareCostStates)[number]

export const advanceStates = ['rejected', 'appliedFor', 'approved', 'completed'] as const
export type AdvanceState = (typeof advanceStates)[number]

export const anyStates = new Set([...travelStates, ...expenseReportStates, ...healthCareCostStates, ...advanceStates])
export type AnyState = TravelState | HealthCareCostState | ExpenseReportState | AdvanceState

const transportTypesButOwnCar = ['airplane', 'shipOrFerry', 'otherTransport'] as const
export const transportTypes = ['ownCar', ...transportTypesButOwnCar] as const
export type TransportType = (typeof transportTypes)[number]

export const distanceRefundTypes = ['car', 'motorcycle', 'halfCar'] as const
export type DistanceRefundType = (typeof distanceRefundTypes)[number]

export const imageTypes = ['image/jpeg', 'image/png'] as const
export type ImageType = (typeof imageTypes)[number]

export const documentFileTypes = ['application/pdf', ...imageTypes] as const
export type DocumentFileType = (typeof documentFileTypes)[number]

export const reportTypes = ['travel', 'expenseReport', 'healthCareCost', 'advance'] as const
export type ReportType = (typeof reportTypes)[number]

export const retention = [
  'deleteRefundedAfterXDays',
  'deleteApprovedTravelAfterXDaysUnused',
  'deleteInWorkReportsAfterXDaysUnused',
  'mailXDaysBeforeDeletion'
] as const
export type RetentionType = (typeof retention)[number]

export type schemaNames = 'Travel' | 'ExpenseReport' | 'HealthCareCost'

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
  'confirm/healthCareCost',
  'refunded/travel',
  'refunded/expenseReport',
  'refunded/healthCareCost',
  'admin'
] as const
export type Access = (typeof accesses)[number]

export const meals = ['breakfast', 'lunch', 'dinner'] as const
export type Meal = (typeof meals)[number]

export const fontNames = ['NotoSans'] as const
export type FontName = (typeof fontNames)[number]

export type PageOrientation = 'portrait' | 'landscape'

export const cateringTypes = ['catering8', 'catering24'] as const
export type CateringType = (typeof cateringTypes)[number]

export const lumpsumTypes = ['overnight', ...cateringTypes] as const
export type LumpsumType = (typeof lumpsumTypes)[number]
export type LumpSum = { [key in LumpsumType]: number }

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

export const userReplaceCollections = ['travels', 'expensereports', 'healthcarecosts'] as const
export type UserReplaceReferencesResult = {
  [key in (typeof userReplaceCollections)[number] | 'documentfiles']?: { matchedCount: number; modifiedCount: number }
}

export function reportIsTravel(report: Travel | ExpenseReport | HealthCareCost | Advance): report is Travel
export function reportIsTravel(report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple | Advance): report is TravelSimple
export function reportIsTravel(report: any): report is { startDate: Date | string } {
  return typeof report.startDate === 'string' || report.startDate instanceof Date
}

export function reportIsHealthCareCost(report: Travel | ExpenseReport | HealthCareCost | Advance): report is HealthCareCost
export function reportIsHealthCareCost(
  report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple | Advance
): report is HealthCareCostSimple
export function reportIsHealthCareCost(report: any): report is { patientName: string } {
  return typeof report.patientName === 'string'
}

export function reportIsAdvance(report: Travel | ExpenseReport | HealthCareCost | Advance): report is Advance
export function reportIsAdvance(report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple | Advance): report is Advance
export function reportIsAdvance(report: any): report is { startDate: Date | string } {
  return !reportIsTravel(report) && typeof report.reason === 'string'
}

export function reportIsExpenseReport(report: Travel | ExpenseReport | HealthCareCost | Advance): report is ExpenseReport
export function reportIsExpenseReport(
  report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple | Advance
): report is ExpenseReportSimple
export function reportIsExpenseReport(report: any): report is any {
  return !reportIsTravel(report) && !reportIsAdvance(report) && !reportIsHealthCareCost(report)
}

export type AddUpResult<T extends Travel | ExpenseReport | HealthCareCost> = T extends Travel
  ? {
      balance: BaseCurrencyMoney
      total: BaseCurrencyMoney
      advance: BaseCurrencyMoney
      expenses: BaseCurrencyMoney
      lumpSums: BaseCurrencyMoney
      advanceOverflow: boolean
    }
  : {
      balance: BaseCurrencyMoney
      total: BaseCurrencyMoney
      advance: BaseCurrencyMoney
      expenses: BaseCurrencyMoney
      advanceOverflow: boolean
    }

export const emailRegex =
  /([-!#-'*+/-9=?A-Z^-~]+(\.[-!#-'*+/-9=?A-Z^-~]+)*|"(!#-[^-~ \t]|(\\[\t -~]))+")@[0-9A-Za-z]([0-9A-Za-z-]{0,61}[0-9A-Za-z])?(\.[0-9A-Za-z]([0-9A-Za-z-]{0,61}[0-9A-Za-z])?)+/

export const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const hexColorRegex = /^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/

export const baseCurrency: Currency = {
  _id: 'EUR',
  flag: '🇪🇺',
  name: {
    de: 'Euro',
    en: 'euro'
  },
  subunit: 'Cent',
  symbol: '€'
}
export const defaultLocale: Locale = 'de'
