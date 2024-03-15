import { Currency, CurrencyCode, DocumentFile, Money, Travel, TravelDay, TravelSimple, _id } from '../../common/types.js'
import { SetterBody } from './controller.js'

export type IdDocument<idType = _id> = idType | { _id: idType }

export interface File extends Omit<DocumentFile, 'data' | 'owner'> {
  /**
   * @format binary
   */
  data?: string
}

interface MoneyPost extends Omit<Money, 'currency'> {
  amount: Money['amount']
  currency: IdDocument<CurrencyCode> | Currency
  exchangeRate: Money['exchangeRate'] | undefined
}

export interface MoneyPlusPost extends MoneyPost {
  receipts?: File[]
  date?: Date
}

export interface TravelApplication extends SetterBody<Omit<TravelSimple, 'comments' | 'comment' | 'progress' | 'advance'>> {
  advance: MoneyPost | undefined
}

export interface TravelPost extends Omit<TravelSimple, 'state' | 'comments' | 'comment' | 'progress'> {
  claimOvernightLumpSum: Travel['claimOvernightLumpSum']
  lastPlaceOfWork: Travel['lastPlaceOfWork']
  days: TravelDayPost[]
}

export interface TravelDayPost extends Omit<TravelDay, 'refunds' | 'special' | 'country'> {
  date: Date
}
