import { Request as ExRequest } from 'express'
import { Currency, CurrencyCode, DocumentFile, Money, Travel, TravelDay, TravelSimple, _id } from '../../common/types.js'
import { SetterBody } from './controller.js'

export interface AuthenticatedExpressRequest extends ExRequest {
  user: Express.User
}

export type IdDocument<idType = _id> = idType | { _id: idType }

export function idDocumentToId<idType>(doc: IdDocument<idType>): idType {
  return (doc as { _id: idType })._id || (doc as idType)
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
  extends SetterBody<Omit<TravelSimple, 'comments' | 'comment' | 'progress' | 'advance' | 'log' | 'addUp'>> {
  advance: MoneyPost | undefined
}

export interface TravelPost extends Omit<TravelSimple, 'state' | 'comments' | 'comment' | 'progress' | 'log' | 'addUp'> {
  lastPlaceOfWork: Travel['lastPlaceOfWork']
  days: TravelDayPost[]
}

export interface TravelDayPost extends Omit<TravelDay, 'refunds' | 'special' | 'country' | '_id'> {
  date: Date
}
