import { CountrySimple, Currency, DocumentFileType, Locale, Contact, Access, _id } from '../../common/types.js'

type Document = _id | { _id: _id }

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
  insurance?: Document | null
  organisation?: Document | null
}
