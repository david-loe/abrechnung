import settings from './settings.json'

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

export interface Country extends CountrySimple {
  lumpSums: [
    {
      validFrom: Date
      catering24: number
      catering8: number
      overnight: number
      spezials?: [
        {
          city: string
          catering24: number
          catering8: number
          overnight: number
        }
      ]
    }
  ]
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
  data?: Blob
  type: 'image/jpeg' | 'image/png' | 'application/pdf'
  name: string
  _id?: string
}

export interface UserSimple {
  uid: string
  email: string
  name: string
  _id: string
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

export interface Money {
  amount: number | null
  currency: Currency | string
  exchangeRate?: {
    date: Date
    rate: number
    amount: number
  }
}

export interface Cost extends Money {
  receipts: Array<DocumentFile>
  date: Date | string
}

export interface Stage {
  departure: Date | string
  arrival: Date | string
  startLocation: Place
  endLocation: Place
  midnightCountries?: { date: Date; country: CountrySimple }[]
  distance?: number | null
  transport: 'ownCar' | 'airplane' | 'shipOrFerry' | 'otherTransport'
  cost: Cost
  purpose: 'professional' | 'mixed' | 'private'
  _id: string
}

export interface Expense {
  description: string
  cost: Cost
  purpose: 'professional' | 'mixed'
  _id: string
}

export interface TravelSimple {
  name: string
  traveler: UserSimple
  state: State
  editor: UserSimple
  comments: [{ text: string; author: UserSimple }]
  reason: string
  destinationPlace: Place
  travelInsideOfEU: boolean
  startDate: Date | string
  endDate: Date | string
  advance: Money
  progress: number
  _id: string
  claimSpouseRefund?: boolean //settings.allowSpouseRefund
  fellowTravelersNames?: string //settings.allowSpouseRefund
}

export interface Travel extends TravelSimple {
  claimOvernightLumpSum: boolean
  professionalShare: number
  history: Array<string>
  historic: boolean
  stages: Array<Stage>
  expenses: Array<Expense>
  days: [
    {
      date: Date
      country: CountrySimple
      cateringNoRefund: {
        breakfast: boolean
        lunch: boolean
        dinner: boolean
      }
      purpose: 'professional' | 'private'
      refunds: [
        {
          type: 'overnight' | 'catering8' | 'catering24'
          refund: Money
        }
      ]
    }
  ]
}

export type Locale = 'de' | 'en'

export type State = 'rejected' | 'appliedFor' | 'approved' | 'underExamination' | 'refunded'
