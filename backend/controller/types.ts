import { _id, Money, DocumentFile, TravelSimple, Travel, TravelDay } from '../../common/types.js'

export type IdDocument = _id | { _id: _id }

export interface File extends Omit<DocumentFile, 'data' | 'owner'> {
  /**
   * @format binary
   */
  data?: string
}

export interface MoneyPlusPost extends Money {
  receipts?: File[]
  date?: Date
}

export interface TravelApplication extends Omit<TravelSimple, 'state' | 'comments' | 'comment' | 'progress' | 'name' | '_id' | 'advance'> {
  name?: TravelSimple['name']
  advance?: TravelSimple['advance']
  _id?: TravelSimple['_id']
}

export interface TravelPost extends TravelApplication {
  claimOvernightLumpSum: Travel['claimOvernightLumpSum']
  lastPlaceOfWork: Travel['lastPlaceOfWork']
  days: TravelDayPost[]
}

export interface TravelDayPost extends Omit<TravelDay, 'refunds' | 'special' | 'country'> {
  date: Date
}
