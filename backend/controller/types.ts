import {
  Currency,
  CurrencyCode,
  DocumentFile,
  DocumentFileType,
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

export interface TravelApplication
  extends SetterBody<
    Omit<TravelSimple<Types.ObjectId>, 'comments' | 'comment' | 'progress' | 'advance' | 'log' | 'addUp' | 'editor' | 'owner'>
  > {
  advance: MoneyPost | undefined
}

export interface TravelPost extends Omit<TravelSimple<Types.ObjectId>, 'state' | 'comments' | 'comment' | 'progress' | 'log' | 'addUp'> {
  lastPlaceOfWork: Travel<Types.ObjectId>['lastPlaceOfWork']
  days: TravelDayPost[]
}

export interface TravelDayPost extends Omit<TravelDay<Types.ObjectId>, 'lumpSums' | 'special' | 'country' | '_id'> {
  date: Date
}
