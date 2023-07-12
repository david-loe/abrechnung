export interface Country {
  name: {
    de: string
    en?: string
  }
  alias?: {
    de: string
    en: string
  }
  _id: string
  flag?: string
  lumpSums?: Array<{
    validFrom: Date
    catering24: number
    catering8: number
    overnight: number
    spezials?: Array<{
      city: string
      catering24: number
      catering8: number
      overnight: number
    }>
  }>
  lumpSumsFrom?: string
  currency?: string
}

export interface Place {
  place: string
  country: Country
}

export interface UserSimple {
  uid: string
  email: string
  name: string
}

export interface User extends UserSimple {
  access: {
    examine: boolean
    approve: boolean
    admin: boolean
  }
  settings: {
    language: Locale
    lastCurrencies?: Array<string>
  }
}

export type Locale = 'de' | 'en'

export type State = 'rejected' | 'appliedFor' | 'approved' | 'underExamination' | 'refunded'
