import { Types } from 'mongoose'

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
  flag?: string
  currency?: Currency
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
  lumpSumsFrom?: string
}

export interface Currency {
  name: {
    de: string
    en: string
  }
  _id: string
  subunit?: string
  symbol?: string
  flag?: string
}

export interface Place {
  place: string
  country: CountrySimple
}

export interface DocumentFile {
  data: Types.Buffer
  owner: Types.ObjectId
  type: 'image/jpeg' | 'image/png' | 'application/pdf'
  name: string
  _id?: Types.ObjectId
}

export interface Token {
  _id: Types.ObjectId
  createdAt: Date | string
  files: DocumentFile[]
}

export interface UserSimple {
  uid: string
  email: string
  name: string
  _id: Types.ObjectId
}

export type Access = 'examine' | 'approve' | 'admin'

export interface User extends UserSimple {
  access: {
    [key in Access]: boolean
  }
  settings: {
    language: Locale
    lastCurrencies: Currency[]
    lastCountries: CountrySimple[]
  }
  vehicleRegistration?: DocumentFile[]
  token?: Token
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

export interface Cost extends Money {
  receipts: DocumentFile[]
  date: Date | string
}

export interface Stage {
  departure: Date | string
  arrival: Date | string
  startLocation: Place
  endLocation: Place
  midnightCountries?: { date: Date | string; country: CountrySimple }[]
  distance?: number | null
  transport: Transport
  cost: Cost
  purpose: Purpose
  _id: Types.ObjectId
}

export interface Expense {
  description: string
  cost: Cost
  purpose: 'professional' | 'mixed'
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

export interface TravelSimple {
  name: string
  traveler: UserSimple
  state: TravelState
  editor: UserSimple
  comments: TravelComment[]
  comment?: string
  reason: string
  destinationPlace: Place
  travelInsideOfEU: boolean
  startDate: Date | string
  endDate: Date | string
  advance: Money
  progress: number
  _id: Types.ObjectId
  createdAt?: Date | string
  claimSpouseRefund?: boolean //settings.allowSpouseRefund
  fellowTravelersNames?: string //settings.allowSpouseRefund
}

export type LumpsumType = 'overnight' | 'catering8' | 'catering24'

export interface Refund {
  type: LumpsumType
  refund: Money
}

export type Meal = 'breakfast' | 'lunch' | 'dinner'

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
  state: ExpenseReportState
  editor: UserSimple
  comments: ExpenseReportComment[]
  comment?: string
  createdAt?: Date | string
  _id: Types.ObjectId
}

export interface ExpenseReport extends ExpenseReportSimple {
  history: Types.ObjectId[]
  historic: boolean
  expenses: Expense[]
}
export type Locale = 'de' | 'en'

export type TravelState = 'rejected' | 'appliedFor' | 'approved' | 'underExamination' | 'refunded'

export type ExpenseReportState = 'rejected' | 'inWork' | 'underExamination' | 'refunded'

export type Transport = 'ownCar' | 'airplane' | 'shipOrFerry' | 'otherTransport'

export type PurposeSimple = 'professional' | 'private'

export type Purpose = PurposeSimple | 'mixed'

export interface Meta {
  count: number
  page: number
  limit: number
  countPages: number
}
