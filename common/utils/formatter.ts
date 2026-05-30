import { BaseCurrencyMoney, baseCurrency, idDocumentToId, Locale, Money, Name, NameDisplayFormat } from '../types.js'
import { baseCurrencyMoneyToMoney, isValidDate } from './scripts.js'

type MoneyStringOptions = { locale?: Locale; useExchangeRate?: boolean; func?: (x: number) => number; warning?: boolean }

class Formatter {
  private _dateFormat!: Intl.DateTimeFormat
  private _simpleDateFormat!: Intl.DateTimeFormat
  private _dateTimeFormat!: Intl.DateTimeFormat
  private _simpleDateTimeFormat!: Intl.DateTimeFormat
  private _baseCurrencyFormat!: Intl.NumberFormat
  private _floatFormat!: Intl.NumberFormat
  private _dateFormatOptions: Intl.DateTimeFormatOptions = { timeZone: 'UTC', month: 'numeric', day: 'numeric', year: 'numeric' }
  private _simpleDateFormatOptions: Intl.DateTimeFormatOptions = { timeZone: 'UTC', month: 'numeric', day: 'numeric' }
  private _dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }
  private _simpleDateTimeFormatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'UTC',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }
  private _baseCurrencyFormatOptions: Intl.NumberFormatOptions = { style: 'currency', currency: baseCurrency._id }
  private _floatFormatOptions: Intl.NumberFormatOptions = { maximumFractionDigits: 4 }
  locale!: Locale
  nameDisplayFormat!: NameDisplayFormat

  constructor(locale: Locale, nameDisplayFormat: NameDisplayFormat) {
    this.setLocale(locale)
    this.setNameDisplayFormat(nameDisplayFormat)
  }
  setLocale(locale?: Locale) {
    if (locale && locale !== this.locale) {
      this.locale = locale
      this._dateFormat = new Intl.DateTimeFormat(locale, this._dateFormatOptions)
      this._simpleDateFormat = new Intl.DateTimeFormat(locale, this._simpleDateFormatOptions)
      this._dateTimeFormat = new Intl.DateTimeFormat(locale, this._dateTimeFormatOptions)
      this._simpleDateTimeFormat = new Intl.DateTimeFormat(locale, this._simpleDateTimeFormatOptions)
      this._baseCurrencyFormat = new Intl.NumberFormat(locale, this._baseCurrencyFormatOptions)
      this._floatFormat = new Intl.NumberFormat(locale, this._floatFormatOptions)
    }
  }
  setNameDisplayFormat(nameDisplayFormat: NameDisplayFormat) {
    this.nameDisplayFormat = nameDisplayFormat
  }
  /**
   * Day + Month + Year
   */
  date(date: string | number | Date, locale?: Locale) {
    this.setLocale(locale)
    const validDate = isValidDate(date)
    if (validDate) {
      return this._dateFormat.format(validDate)
    }
    return ''
  }
  /**
   * Day + Month
   */
  simpleDate(date: string | number | Date, locale?: Locale) {
    this.setLocale(locale)
    const validDate = isValidDate(date)
    if (validDate) {
      return this._simpleDateFormat.format(validDate)
    }
    return ''
  }
  /**
   * Day + Month + Year + Hour + Minute
   */
  dateTime(date: string | number | Date, locale?: Locale) {
    this.setLocale(locale)
    const validDate = isValidDate(date)
    if (validDate) {
      return this._dateTimeFormat.format(validDate)
    }
    return ''
  }
  /**
   * Day + Month + Hour + Minute
   */
  simpleDateTime(date: string | number | Date, locale?: Locale) {
    this.setLocale(locale)
    const validDate = isValidDate(date)
    if (validDate) {
      return this._simpleDateTimeFormat.format(validDate)
    }
    return ''
  }
  baseCurrency(number: number) {
    return this._baseCurrencyFormat.format(number)
  }
  currency(number: number, currency: string = baseCurrency._id) {
    if (currency === baseCurrency._id) {
      return this.baseCurrency(number)
    }
    return number.toLocaleString(this.locale, { style: 'currency', currency: currency })
  }
  float(number: number) {
    return this._floatFormat.format(number)
  }

  money(baseMoney: BaseCurrencyMoney | Money, options?: MoneyStringOptions): string {
    const opts = Object.assign({ useExchangeRate: true, warning: false, func: (x: number) => x }, options)
    this.setLocale(opts.locale)
    let amount = 0
    const money = baseCurrencyMoneyToMoney(baseMoney)
    let currency = idDocumentToId(money.currency)
    if (opts.useExchangeRate && money.exchangeRate) {
      amount = money.exchangeRate.amount
      currency = baseCurrency._id
    } else {
      if (money.amount !== null) {
        amount = money.amount
      }
      if (opts.useExchangeRate && !money.exchangeRate && currency !== baseCurrency._id) {
        opts.warning = true
      }
    }
    return this.currency(opts.func(amount), currency) + (opts.warning ? ' ⚠' : '')
  }
  detailedMoney(baseMoney: Money | BaseCurrencyMoney, printZero = false, locale?: Locale): string {
    this.setLocale(locale)
    const money = baseCurrencyMoneyToMoney(baseMoney)
    if (money.amount === null || (!money.amount && !printZero)) {
      return ''
    }
    let str = this.currency(money.amount, idDocumentToId(money.currency))
    if (money.exchangeRate?.rate) {
      str = `${str} * ${this.float(money.exchangeRate.rate)} = ${this.baseCurrency(money.exchangeRate.amount)}`
    }
    return str
  }
  name(name?: Name, length: 'long' | 'short' | 'shortWithoutPoint' = 'long') {
    if (!name) {
      return ''
    }
    if (this.nameDisplayFormat === 'givenNameFirst') {
      return `${name.givenName} ${length === 'long' ? name.familyName : `${name.familyName.substring(0, 1)}${length === 'short' ? '.' : ''}`}`
    }
    return `${name.familyName}, ${length === 'long' ? name.givenName : `${name.givenName.substring(0, 1)}${length === 'short' ? '.' : ''}`}`
  }
}

export default Formatter
