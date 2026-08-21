import {
  CostPosition,
  Currency,
  CurrencyCode,
  DocumentFileType,
  Expense,
  IdDocument,
  Money,
  Travel,
  TravelDay,
  TravelSimple
} from 'abrechnung-common/types.js'
import { Request as ExRequest } from 'express'
import { Types } from 'mongoose'
import { SetterBody } from './controller.js'

export interface AuthenticatedExpressRequest extends ExRequest {
  user: Express.User
}

export interface File {
  /**
   * @format binary
   */
  data?: string
  type: DocumentFileType
  name: string
  _id?: string
}

export interface MoneyPost extends Omit<Money, 'currency'> {
  amount: Money['amount']
  currency: IdDocument<CurrencyCode> | Currency
  exchangeRate: Money['exchangeRate'] | undefined
}

export interface MoneyPlusPost extends MoneyPost {
  receipts?: File[]
  date?: Date
}

interface ExpenseBulkImportPositionPost extends Omit<CostPosition<Types.ObjectId>, '_id' | 'project' | 'category'> {
  _id?: string
  project: string
  category: string
}

export interface ExpenseBulkImportCostPost {
  positions: ExpenseBulkImportPositionPost[]
  currency: CurrencyCode
  date: Date
}

export interface ExpenseBulkImportPost extends Omit<SetterBody<Expense<Types.ObjectId>>, 'cost'> {
  cost: ExpenseBulkImportCostPost
}

export interface TravelApplication
  extends SetterBody<
    Omit<TravelSimple<Types.ObjectId>, 'comments' | 'comment' | 'progress' | 'advance' | 'log' | 'addUp' | 'editor' | 'owner'>
  > {
  advance: MoneyPost | undefined
}

export interface AdvanceBulkImportPost {
  owner: string
  project: string
  name?: string
  reason: string
  budget: { amount: number; currency: string }
  exchangeRateDate?: Date | string
  comment?: string
  bookingRemark?: string
}

export interface TravelBulkImportPost {
  owner: string
  project: string
  name?: string
  reason: string
  destinationPlace: { place: string; country: string }
  startDate: Date | string
  endDate: Date | string
  claimSpouseRefund?: boolean
  fellowTravelersNames?: string
  advances?: string[]
  isCrossBorder?: boolean
  a1Certificate?: { exactAddress?: string; destinationName?: string }
}

export interface ExpenseReportBulkImportPost {
  owner: string
  project: string
  name?: string
  advances?: string[]
  currency?: CurrencyCode
}

export interface TravelPost extends Omit<TravelSimple<Types.ObjectId>, 'state' | 'comments' | 'comment' | 'progress' | 'log' | 'addUp'> {
  lastPlaceOfWork: Travel<Types.ObjectId>['lastPlaceOfWork']
  days: TravelDayPost[]
}

export interface TravelDayPost extends Omit<TravelDay<Types.ObjectId>, 'lumpSums' | 'special' | 'country' | '_id'> {
  date: Date
}
