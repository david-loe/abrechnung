import { baseCurrencyMoneyToMoney, isValidDate } from './scripts.js'
import { BaseCurrencyMoney, Locale, Money, baseCurrency } from './types.js'

type MoneyStringOptions = { locale?: Locale; useExchangeRate?: boolean; func?: (x: number) => number; warning?: boolean }

class Formatter {
  #dateFormat!: Intl.DateTimeFormat
  #simpleDateFormat!: Intl.DateTimeFormat
  #simpleDateTimeFormat!: Intl.DateTimeFormat
  #baseCurrencyFormat!: Intl.NumberFormat
  #floatFormat!: Intl.NumberFormat
  #dateFormatOptions: Intl.DateTimeFormatOptions = { timeZone: 'UTC', month: 'numeric', day: 'numeric', year: 'numeric' }
  #simpleDateFormatOptions: Intl.DateTimeFormatOptions = { timeZone: 'UTC', month: 'numeric', day: 'numeric' }
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

  constructor(locale: Locale) {
    this.setLocale(locale)
  }
  setLocale(locale?: Locale) {
    if (locale && locale !== this.locale) {
      this.locale = locale
      this.#dateFormat = new Intl.DateTimeFormat(locale, this.#dateFormatOptions)
      this.#simpleDateFormat = new Intl.DateTimeFormat(locale, this.#simpleDateFormatOptions)
      this.#simpleDateTimeFormat = new Intl.DateTimeFormat(locale, this.#simpleDateTimeFormatOptions)
      this.#baseCurrencyFormat = new Intl.NumberFormat(locale, this.#baseCurrencyFormatOptions)
      this.#floatFormat = new Intl.NumberFormat(locale, this.#floatFormatOptions)
    }
  }
  date(date: string | number | Date, locale?: Locale) {
    this.setLocale(locale)
    const validDate = isValidDate(date)
    if (validDate) {
      return this.#dateFormat.format(validDate)
    } else {
      return ''
    }
  }
  simpleDate(date: string | number | Date, locale?: Locale) {
    this.setLocale(locale)
    const validDate = isValidDate(date)
    if (validDate) {
      return this.#simpleDateFormat.format(validDate)
    } else {
      return ''
    }
  }
  simpleDateTime(date: string | number | Date, locale?: Locale) {
    this.setLocale(locale)
    const validDate = isValidDate(date)
    if (validDate) {
      return this.#simpleDateTimeFormat.format(validDate)
    } else {
      return ''
    }
  }
  baseCurrency(number: number) {
    return this.#baseCurrencyFormat.format(number)
  }
  currency(number: number, currency: string = baseCurrency._id) {
    if (currency === baseCurrency._id) {
      return this.baseCurrency(number)
    } else {
      return number.toLocaleString(this.locale, {
        style: 'currency',
        currency: currency
      })
    }
  }
  float(number: number) {
    return this.#floatFormat.format(number)
  }

  money(baseMoney: BaseCurrencyMoney | Money, options?: MoneyStringOptions): string {
    const opts = Object.assign({ useExchangeRate: true, warning: false, func: (x: number) => x }, options)
    this.setLocale(opts.locale)
    var amount = 0
    const money = baseCurrencyMoneyToMoney(baseMoney)
    var currency = typeof money.currency === 'string' ? money.currency : money.currency._id
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
    if (!money || (money && (typeof money.amount !== 'number' || (!money.amount && !printZero)))) {
      return ''
    }
    var str = this.currency(money.amount!, money.currency._id)
    if (money.exchangeRate && money.exchangeRate.rate) {
      str = str + ' / ' + this.float(money.exchangeRate.rate) + ' = ' + this.baseCurrency(money.exchangeRate.amount)
    }
    return str
  }
}

export default Formatter
