import { Types } from 'mongoose'

export interface Settings {
  accessIcons: { [key in Access]: string[] }
  allowSpouseRefund: boolean
  baseCurrency: Currency
  breakfastCateringLumpSumCut: number
  lunchCateringLumpSumCut: number
  dinnerCateringLumpSumCut: number
  factorCateringLumpSum: number
  factorCateringLumpSumExceptions: string[]
  factorOvernightLumpSum: number
  factorOvernightLumpSumExceptions: string[]
  fallBackLumpSumCountry: string
  maxTravelDayCount: number
  distanceRefunds: { [key in DistanceRefundType]: number }
  secoundNightOnAirplaneLumpSumCountry: string
  secoundNightOnShipOrFerryLumpSumCountry: string
  stateColors: { [key in TravelState | HealthCareCostState | ExpenseReportState]: { color: string; text: string } }
  toleranceStageDatesToApprovedTravelDates: number
  uploadTokenExpireAfterSeconds: number
  version: string
  migrateFrom?: string | null
}

export interface CountrySimple {
  name: {
    de: string
    en: string
  }
  alias?: {
    de: string
    en?: string
  }
  _id: string
  flag?: string | null
  currency?: Currency | null
}

export interface CountryLumpSum {
  validFrom: Date | string
  catering24: number
  catering8: number
  overnight: number
  spezials?: {
    city: string
    catering24: number
    catering8: number
    overnight: number
  }[]
}

export interface Country extends CountrySimple {
  lumpSums: CountryLumpSum[]
  lumpSumsFrom?: string | null
}

export interface Currency {
  name: {
    de: string
    en: string
  }
  _id: string
  subunit?: string | null
  symbol?: string | null
  flag?: string | null
}

export interface Place {
  place: string
  country: CountrySimple
}

export interface DocumentFile {
  data: Types.Buffer
  owner: Types.ObjectId
  type: DocumentFileType
  name: string
  _id?: Types.ObjectId
}

export interface Token {
  _id: Types.ObjectId
  createdAt: Date | string
  files: DocumentFile[]
}

export interface UserSimple {
  email: string
  name: { givenName: string; familyName: string }
  _id: Types.ObjectId
}

export interface HealthInsurance {
  name: string
  email: string
  _id: Types.ObjectId
}

export interface OrganisationSimple {
  name: string
  _id: Types.ObjectId
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
  }
  access: {
    [key in Access]: boolean
  }
  settings: {
    language: Locale
    lastCurrencies: Currency[]
    lastCountries: CountrySimple[]
    insurance?: HealthInsurance | null
    organisation?: Organisation | null
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
  distance?: number | null
  distanceRefundType?: DistanceRefundType | null
  transport: Transport
  cost: Cost
  purpose: Purpose
  _id: Types.ObjectId
}

export interface Expense {
  description: string
  cost: Cost
  _id: Types.ObjectId
}

export interface TravelExpense extends Expense {
  purpose: 'professional' | 'mixed'
}

export type RecordType = 'stage' | 'expense'
export type Record = Stage | TravelExpense

export interface Comment {
  text: string
  author: UserSimple
  _id: Types.ObjectId
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

export interface TravelSimple {
  name: string
  traveler: UserSimple
  organisation: OrganisationSimple
  state: TravelState
  editor: UserSimple
  comments: TravelComment[]
  comment?: string | null
  reason: string
  destinationPlace: Place
  travelInsideOfEU: boolean
  startDate: Date | string
  endDate: Date | string
  advance: Money
  progress: number
  _id: Types.ObjectId
  createdAt: Date | string
  updatedAt: Date | string
  claimSpouseRefund?: boolean | null //settings.allowSpouseRefund
  fellowTravelersNames?: string | null //settings.allowSpouseRefund
}

export interface Refund {
  type: LumpsumType
  refund: Money
}

export interface TravelDay {
  date: Date | string
  country: CountrySimple
  cateringNoRefund: {
    [key in Meal]: boolean
  }
  purpose: PurposeSimple
  refunds: Refund[]
  _id: Types.ObjectId
}

export interface Travel extends TravelSimple {
  claimOvernightLumpSum: boolean
  professionalShare: number | null
  history: Types.ObjectId[]
  historic: boolean
  stages: Stage[]
  expenses: TravelExpense[]
  days: TravelDay[]
}

export interface ExpenseReportSimple {
  name: string
  expensePayer: UserSimple
  organisation: OrganisationSimple
  state: ExpenseReportState
  editor: UserSimple
  comments: ExpenseReportComment[]
  comment?: string | null
  createdAt: Date | string
  updatedAt: Date | string
  _id: Types.ObjectId
}

export interface ExpenseReport extends ExpenseReportSimple {
  history: Types.ObjectId[]
  historic: boolean
  expenses: Expense[]
}

export interface HealthCareCostSimple {
  name: string
  applicant: UserSimple
  organisation: OrganisationSimple
  patientName: string
  insurance: HealthInsurance
  refundSum: MoneyPlus
  state: HealthCareCostState
  editor: UserSimple
  comments: HealthCareCostComment[]
  comment?: string | null
  createdAt: Date | string
  updatedAt: Date | string
  _id: Types.ObjectId
}

export interface HealthCareCost extends HealthCareCostSimple {
  history: Types.ObjectId[]
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

export const transports = ['ownCar', 'airplane', 'shipOrFerry', 'otherTransport'] as const
export type Transport = (typeof transports)[number]

export const distanceRefundTypes = ['car', 'motorcycle', 'halfCar'] as const
export type DistanceRefundType = (typeof distanceRefundTypes)[number]

export const documentFileTypes = ['image/jpeg', 'image/png', 'application/pdf'] as const
export type DocumentFileType = (typeof documentFileTypes)[number]

export const accesses = [
  'examine/travel',
  'examine/expenseReport',
  'examine/healthCareCost',
  'confirm/healthCareCost',
  'approve/travel',
  'admin'
] as const
export type Access = (typeof accesses)[number]

export const meals = ['breakfast', 'lunch', 'dinner'] as const
export type Meal = (typeof meals)[number]

export const lumpsumTypes = ['overnight', 'catering8', 'catering24'] as const
export type LumpsumType = (typeof lumpsumTypes)[number]

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
