import { CountrySimple, Currency, DocumentFileType, Locale, Contact, Access, _id, Money } from '../../common/types.js'

export type IdDocument = _id | { _id: _id }

export interface File {
  type: DocumentFileType
  name: string
  /**
   * @format binary
   */
  data?: string
  _id?: _id
}

export interface UserPost extends Contact {
  _id?: _id
  fk?: {
    microsoft?: string | null
    ldapauth?: string | null
    magiclogin?: string | null
  }
  access?: {
    [key in Access]?: boolean
  }
  loseAccessAt?: Date | string | null
  settings?: UserSettingsPost
}

export interface UserSettingsPost {
  language?: Locale
  lastCurrencies?: Currency[]
  lastCountries?: CountrySimple[]
  insurance?: IdDocument | null
  organisation?: IdDocument | null
}

export interface CostPost extends Money {
  receipts: File[]
  date: Date
}

export interface MoneyPlusPost extends Money {
  receipts?: File[]
  date?: Date
}

export interface ExpensePost {
  description: string
  cost: CostPost
  _id?: _id
}
