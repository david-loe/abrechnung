import { BaseCurrencyMoney, baseCurrency, idDocumentToId, Locale, Money, Name, NameDisplayFormat } from '../types.js'
import { baseCurrencyMoneyToMoney, isValidDate } from './scripts.js'

type MoneyStringOptions = { locale?: Locale; useExchangeRate?: boolean; func?: (x: number) => number; warning?: boolean }

class Formatter {
  #dateFormat!: Intl.DateTimeFormat
  #simpleDateFormat!: Intl.DateTimeFormat
  #dateTimeFormat!: Intl.DateTimeFormat
  #simpleDateTimeFormat!: Intl.DateTimeFormat
  #baseCurrencyFormat!: Intl.NumberFormat
  #floatFormat!: Intl.NumberFormat
  #dateFormatOptions: Intl.DateTimeFormatOptions = { timeZone: 'UTC', month: 'numeric', day: 'numeric', year: 'numeric' }
  #simpleDateFormatOptions: Intl.DateTimeFormatOptions = { timeZone: 'UTC', month: 'numeric', day: 'numeric' }
  #dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }
  #simpleDateTimeFormatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'UTC',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }
  #baseCurrencyFormatOptions: Intl.NumberFormatOptions = { style: 'currency', currency: baseCurrency._id }
  #floatFormatOptions: Intl.NumberFormatOptions = { maximumFractionDigits: 4 }
  locale!: Locale
  nameDisplayFormat!: NameDisplayFormat

  constructor(locale: Locale, nameDisplayFormat: NameDisplayFormat) {
    this.setLocale(locale)
    this.setNameDisplayFormat(nameDisplayFormat)
  }
  setLocale(locale?: Locale) {
    if (locale && locale !== this.locale) {
      this.locale = locale
      this.#dateFormat = new Intl.DateTimeFormat(locale, this.#dateFormatOptions)
      this.#simpleDateFormat = new Intl.DateTimeFormat(locale, this.#simpleDateFormatOptions)
      this.#dateTimeFormat = new Intl.DateTimeFormat(locale, this.#dateTimeFormatOptions)
      this.#simpleDateTimeFormat = new Intl.DateTimeFormat(locale, this.#simpleDateTimeFormatOptions)
      this.#baseCurrencyFormat = new Intl.NumberFormat(locale, this.#baseCurrencyFormatOptions)
      this.#floatFormat = new Intl.NumberFormat(locale, this.#floatFormatOptions)
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
      return this.#dateFormat.format(validDate)
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
      return this.#simpleDateFormat.format(validDate)
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
      return this.#dateTimeFormat.format(validDate)
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
      return this.#simpleDateTimeFormat.format(validDate)
    }
    return ''
  }
  baseCurrency(number: number) {
    return this.#baseCurrencyFormat.format(number)
  }
  currency(number: number, currency: string = baseCurrency._id) {
    if (currency === baseCurrency._id) {
      return this.baseCurrency(number)
    }
    return number.toLocaleString(this.locale, { style: 'currency', currency: currency })
  }
  float(number: number) {
    return this.#floatFormat.format(number)
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
      str = `${str} / ${this.float(money.exchangeRate.rate)} = ${this.baseCurrency(money.exchangeRate.amount)}`
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
