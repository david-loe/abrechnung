import { Types } from 'mongoose'

/**
 * @pattern ^[0-9a-fA-F]{24}$
 */
export type _id = Types.ObjectId

export interface Settings {
  accessIcons: { [key in Access]: string[] }
  allowSpouseRefund: boolean
  breakfastCateringLumpSumCut: number
  lunchCateringLumpSumCut: number
  dinnerCateringLumpSumCut: number
  factorCateringLumpSum: number
  factorCateringLumpSumExceptions: CountryCode[]
  factorOvernightLumpSum: number
  factorOvernightLumpSumExceptions: CountryCode[]
  fallBackLumpSumCountry: CountryCode
  maxTravelDayCount: number
  distanceRefunds: { [key in DistanceRefundType]: number }
  secoundNightOnAirplaneLumpSumCountry: CountryCode
  secoundNightOnShipOrFerryLumpSumCountry: CountryCode
  stateColors: { [key in AnyState]: { color: string; text: string } }
  toleranceStageDatesToApprovedTravelDates: number
  uploadTokenExpireAfterSeconds: number
  allowTravelApplicationForThePast: boolean
  vehicleRegistrationWhenUsingOwnCar: 'required' | 'optional' | 'none'
  disableReportType: { [key in ReportType]: boolean }
  version: string
  /**
   * @Hidden
   */
  migrateFrom?: string | null
  _id: _id
}

/**
 * @pattern ^[A-Z]{2}$
 */
export type CountryCode = string

export interface CountrySimple {
  name: {
    de: string
    en: string
  }
  alias?: {
    de: string[]
    en?: string[]
  }
  _id: CountryCode
  flag?: string | null
  currency?: CurrencyCode | null
}

export interface CountryLumpSum extends LumpSum {
  validFrom: Date | string
  spezials?: ({
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

export interface DocumentFile {
  data: Types.Buffer
  owner: _id
  type: DocumentFileType
  name: string
  _id?: _id
}

export interface Token {
  _id: _id
  createdAt: Date | string
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
  balance?: number
}

export interface Organisation extends OrganisationSimple {
  subfolderPath: string
  bankDetails?: string | null
  companyNumber?: string | null
}

export interface User extends UserSimple {
  fk: {
    microsoft?: string | null
    ldapauth?: string | null
    magiclogin?: string | null
  }
  access: {
    [key in Access]: boolean
  }
  loseAccessAt?: null | Date | string
  settings: {
    language: Locale
    lastCurrencies: Currency[]
    lastCountries: CountrySimple[]
    lastProjects: ProjectSimple[]
    insurance?: HealthInsurance | null
    organisation?: OrganisationSimple | null
  }
  vehicleRegistration?: DocumentFile[] | null
  token?: Token | null
}

export interface Money {
  amount: number | null
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

export type RecordType = 'stage' | 'expense'
export type Record = Stage | TravelExpense

export interface Comment {
  text: string
  author: UserSimple
  _id: _id
}

export interface TravelComment extends Comment {
  toState: TravelState
}

export interface ExpenseReportComment extends Comment {
  toState: ExpenseReportState
}

export interface HealthCareCostComment extends Comment {
  toState: HealthCareCostState
}

export interface TravelSimple extends RequestSimple {
  state: TravelState
  comments: TravelComment[]
  comment?: string | null
  reason: string
  destinationPlace: Place
  travelInsideOfEU: boolean
  startDate: Date | string
  endDate: Date | string
  advance: Money
  progress: number
  claimSpouseRefund?: boolean | null //settings.allowSpouseRefund
  fellowTravelersNames?: string | null //settings.allowSpouseRefund
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
  refund: Money
}

export interface TravelDay {
  date: Date | string
  country: CountrySimple
  special?: string
  cateringNoRefund: {
    [key in Meal]: boolean
  }
  purpose: PurposeSimple
  refunds: Refund[]
  _id: _id
}

export interface RequestSimple {
  name: string
  owner: UserSimple
  state: AnyState
  project: ProjectSimple
  editor: UserSimple
  createdAt: Date | string
  updatedAt: Date | string
  _id: _id
}

export interface Travel extends TravelSimple {
  claimOvernightLumpSum: boolean
  lastPlaceOfWork: Place
  professionalShare: number | null
  history: _id[]
  historic: boolean
  stages: Stage[]
  expenses: TravelExpense[]
  days: TravelDay[]
}

export interface ExpenseReportSimple extends RequestSimple {
  state: ExpenseReportState
  comments: ExpenseReportComment[]
  comment?: string | null
}

export interface ExpenseReport extends ExpenseReportSimple {
  history: _id[]
  historic: boolean
  expenses: Expense[]
}

export interface HealthCareCostSimple extends RequestSimple {
  patientName: string
  insurance: HealthInsurance
  refundSum: MoneyPlus
  state: HealthCareCostState
  comments: HealthCareCostComment[]
  comment?: string | null
}

export interface HealthCareCost extends HealthCareCostSimple {
  history: _id[]
  historic: boolean
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

export type AnyState = TravelState | HealthCareCostState | ExpenseReportState

const transportTypesButOwnCar = ['airplane', 'shipOrFerry', 'otherTransport'] as const
export const transportTypes = ['ownCar', ...transportTypesButOwnCar] as const
export type TransportType = (typeof transportTypes)[number]

export const distanceRefundTypes = ['car', 'motorcycle', 'halfCar'] as const
export type DistanceRefundType = (typeof distanceRefundTypes)[number]

export const documentFileTypes = ['image/jpeg', 'image/png', 'application/pdf'] as const
export type DocumentFileType = (typeof documentFileTypes)[number]

export const reportTypes = ['travel', 'expenseReport', 'healthCareCost'] as const
export type ReportType = (typeof reportTypes)[number]

export const accesses = [
  'user',
  'approve/travel',
  'examine/travel',
  'examine/expenseReport',
  'examine/healthCareCost',
  'confirm/healthCareCost',
  'admin'
] as const
export type Access = (typeof accesses)[number]

export const meals = ['breakfast', 'lunch', 'dinner'] as const
export type Meal = (typeof meals)[number]

export const lumpsumTypes = ['overnight', 'catering8', 'catering24'] as const
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

export function reportIsTravel(report: Travel | ExpenseReport | HealthCareCost): report is Travel
export function reportIsTravel(report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple): report is TravelSimple
export function reportIsTravel(report: any): report is { travelInsideOfEU: boolean } {
  return typeof report.travelInsideOfEU === 'boolean'
}

export function reportIsHealthCareCost(report: Travel | ExpenseReport | HealthCareCost): report is HealthCareCost
export function reportIsHealthCareCost(report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple): report is HealthCareCost
export function reportIsHealthCareCost(report: any): report is { patientName: string } {
  return typeof report.patientName === 'string'
}

export function reportIsExpenseReport(report: Travel | ExpenseReport | HealthCareCost): report is ExpenseReport
export function reportIsExpenseReport(report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple): report is ExpenseReport
export function reportIsExpenseReport(report: any): report is any {
  return !reportIsTravel(report) && !reportIsHealthCareCost(report)
}

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
