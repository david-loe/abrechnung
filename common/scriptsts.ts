import { Currency, Locale, Money, Place, Travel } from './types'
import settings from './settings.json'

function getFlagEmoji(countryCode: string): string | null {
  const noFlag = ['XCD', 'XOF', 'XAF', 'ANG', 'XPF']
  if (noFlag.indexOf(countryCode) !== -1) {
    return null
  }
  const codePoints = countryCode
    .slice(0, 2)
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

function isValidDate(date: Date | string | number): Date | null {
  if (date === null) {
    return null
  }
  const d = new Date(date)
  if (isNaN(d.valueOf())) {
    return null
  } else {
    return d
  }
}

function datetimeToDateString(datetime: Date | string | number): string {
  const date = isValidDate(datetime)
  if (date) {
    return date.toISOString().slice(0, -14)
  } else {
    return ''
  }
}

function datetimeToDatetimeString(datetime: Date | string | number): string {
  const date = isValidDate(datetime)
  if (date) {
    return date.toISOString().slice(0, -8)
  } else {
    return ''
  }
}

function htmlInputStringToDateTime(dateTimeStr: string): Date | null {
  const date = isValidDate(dateTimeStr)
  if (date) {
    return new Date(date.valueOf() - date.getTimezoneOffset() * 60 * 1000)
  } else {
    return null
  }
}

function datetimeToDate(datetime: Date | string | number): Date {
  return new Date(datetimeToDateString(datetime))
}

function getDiffInDays(startDate: Date | string | number, endDate: Date | string | number): number {
  const firstDay = datetimeToDate(startDate)
  const lastDay = datetimeToDate(endDate)
  return (lastDay.valueOf() - firstDay.valueOf()) / (1000 * 60 * 60 * 24)
}

function getDayList(startDate: Date | string | number, endDate: Date | string | number): Date[] {
  const days: Date[] = []
  for (var i = 0; i < getDiffInDays(startDate, endDate) + 1; i++) {
    days.push(new Date(datetimeToDate(startDate).valueOf() + i * 1000 * 60 * 60 * 24))
  }
  return days
}

function getMoneyString(
  money: Money,
  useExchangeRate: boolean = true,
  func: (x: number) => number = (x: number): number => x,
  locale: Locale = 'de'
): string {
  var amount = 0
  if (useExchangeRate && money.exchangeRate) {
    amount = money.exchangeRate.amount
  } else if (money.amount != null) {
    amount = money.amount
  }
  return func(amount).toLocaleString(locale, {
    style: 'currency',
    currency: useExchangeRate && money.exchangeRate ? 'EUR' : typeof money.currency === 'string' ? money.currency : money.currency._id // baseCurrency
  })
}

function getDetailedMoneyString(money: Money, locale: Locale, printZero = false): string {
  if (!money || (money && (typeof money.amount !== 'number' || (!money.amount && !printZero)))) {
    return ''
  }
  var str = money.amount!.toLocaleString(locale, {
    style: 'currency',
    currency: (money.currency as Currency) ? (money.currency as Currency)._id : (money.currency as string)
  })
  if (money.exchangeRate && money.exchangeRate.rate) {
    str = str + ' * ' + money.exchangeRate.rate.toLocaleString(locale, { maximumFractionDigits: 4 }) + ' = '
    str =
      str +
      money.exchangeRate.amount.toLocaleString(locale, {
        style: 'currency',
        currency: 'EUR' // baseCurrency
      })
  }
  return str
}

function placeToString(place: Place, locale: Locale = 'de'): string {
  return place.place + ', ' + place.country.name[locale] + place.country.flag
}

function dateToTimeString(date: string | number | Date): string {
  const dateObject = isValidDate(date)
  if (dateObject) {
    const hour = dateObject.getUTCHours().toString().padStart(2, '0')
    const minute = dateObject.getUTCMinutes().toString().padStart(2, '0')
    return hour + ':' + minute
  } else {
    return ''
  }
}

function datetoDateString(date: string | number | Date): string {
  const dateObject = isValidDate(date)
  if (dateObject) {
    const month = (dateObject.getUTCMonth() + 1).toString().padStart(2, '0')
    const day = dateObject.getUTCDate().toString().padStart(2, '0')
    return day + '.' + month
  } else {
    return ''
  }
}

function dateTimeToString(datetime: string | number | Date): string {
  return datetoDateString(datetime) + ' ' + dateToTimeString(datetime)
}

function datetoDateStringWithYear(date: string | number | Date): string {
  const dateObject = isValidDate(date)
  if (dateObject) {
    const year = dateObject.getUTCFullYear().toString()
    const month = (dateObject.getUTCMonth() + 1).toString().padStart(2, '0')
    const day = dateObject.getUTCDate().toString().padStart(2, '0')
    return day + '.' + month + '.' + year
  } else {
    return ''
  }
}

function getLumpSumsSum(travel: Travel): Money {
  var sum = 0
  for (const day of travel.days) {
    for (const refund of day.refunds) {
      if (refund.refund.amount != null) {
        sum += refund.refund.amount
      }
    }
  }
  return { amount: sum, currency: settings.baseCurrency }
}

function getExpensesSum(travel: Travel): Money {
  var sum = 0
  for (const stage of travel.stages) {
    if (stage.cost && stage.cost.amount != null) {
      if (stage.cost.exchangeRate && typeof stage.cost.exchangeRate.amount == 'number') {
        sum += stage.cost.exchangeRate.amount
      } else {
        sum += stage.cost.amount
      }
    }
  }
  for (const expense of travel.expenses) {
    if (expense.cost && expense.cost.amount != null) {
      if (expense.cost.exchangeRate && typeof expense.cost.exchangeRate.amount == 'number') {
        sum += expense.cost.exchangeRate.amount
      } else {
        sum += expense.cost.amount
      }
    }
  }
  return { amount: sum, currency: settings.baseCurrency }
}

function getTravelTotal(travel: Travel): Money {
  var advance = 0
  if (travel.advance && travel.advance.amount != null) {
    advance = travel.advance.exchangeRate ? travel.advance.exchangeRate.amount : travel.advance.amount
  }
  return { amount: getExpensesSum(travel).amount! + getLumpSumsSum(travel).amount! - advance, currency: settings.baseCurrency }
}

export {
  getFlagEmoji,
  getDiffInDays,
  getDayList,
  datetimeToDateString,
  datetimeToDatetimeString,
  htmlInputStringToDateTime,
  getMoneyString,
  getDetailedMoneyString,
  placeToString,
  dateTimeToString,
  dateToTimeString,
  datetoDateString,
  datetoDateStringWithYear,
  getLumpSumsSum,
  getExpensesSum,
  getTravelTotal
}
