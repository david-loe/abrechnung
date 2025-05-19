import { Request as ExRequest } from 'express'
import { Currency, CurrencyCode, DocumentFile, IdDocument, Money, Travel, TravelDay, TravelSimple, _id } from '../../common/types.js'
import { SetterBody } from './controller.js'

export interface AuthenticatedExpressRequest extends ExRequest {
  user: Express.User
}

export interface File extends Omit<DocumentFile, 'data' | 'owner' | '_id'> {
  /**
   * @format binary
   */
  data?: string
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
  extends SetterBody<Omit<TravelSimple, 'comments' | 'comment' | 'progress' | 'advance' | 'log' | 'addUp' | 'editor' | 'owner'>> {
  advance: MoneyPost | undefined
}

export interface TravelPost extends Omit<TravelSimple, 'state' | 'comments' | 'comment' | 'progress' | 'log' | 'addUp'> {
  lastPlaceOfWork: Travel['lastPlaceOfWork']
  days: TravelDayPost[]
}

export interface TravelDayPost extends Omit<TravelDay, 'lumpSums' | 'special' | 'country' | '_id'> {
  date: Date
}
