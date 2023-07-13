import { Currency, Locale, Money, Place, Travel } from './types'

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

function datetimeToDateString(datetime: Date): string {
  return new Date(datetime).toISOString().slice(0, -14)
}

function datetimeToDate(datetime: Date): Date {
  return new Date(datetimeToDateString(datetime))
}

function getDiffInDays(startDate: Date, endDate: Date): number {
  const firstDay = datetimeToDate(startDate)
  const lastDay = datetimeToDate(endDate)
  return (lastDay.valueOf() - firstDay.valueOf()) / (1000 * 60 * 60 * 24)
}

function getDayList(startDate: Date, endDate: Date): Date[] {
  const days = []
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
  return func(useExchangeRate && money.exchangeRate ? money.exchangeRate.amount : money.amount).toLocaleString(locale, {
    style: 'currency',
    currency:
      useExchangeRate && money.exchangeRate
        ? 'EUR'
        : (money.currency as Currency)
        ? (money.currency as Currency)._id
        : (money.currency as string) // baseCurrency
  })
}

function getDetailedMoneyString(money: Money, locale: Locale, printZero = false): string {
  if (!money || (money && (typeof money.amount !== 'number' || (!money.amount && !printZero)))) {
    return ''
  }
  var str = money.amount.toLocaleString(locale, {
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

function dateToTimeString(date: Date): string {
  if (!date) return ''
  const dateObject = new Date(date)
  const hour = dateObject.getUTCHours().toString().padStart(2, '0')
  const minute = dateObject.getUTCMinutes().toString().padStart(2, '0')
  return hour + ':' + minute
}

function datetoDateString(date: Date): string {
  if (!date) return ''
  const dateObject = new Date(date)
  const month = (dateObject.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = dateObject.getUTCDate().toString().padStart(2, '0')
  return day + '.' + month
}

function dateTimeToString(datetime: Date): string {
  return datetoDateString(datetime) + ' ' + dateToTimeString(datetime)
}

function datetoDateStringWithYear(date: Date): string {
  if (!date) return ''
  const dateObject = new Date(date)
  const year = dateObject.getUTCFullYear().toString()
  const month = (dateObject.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = dateObject.getUTCDate().toString().padStart(2, '0')
  return day + '.' + month + '.' + year
}

function getLumpSumsSum(travel: Travel): Money {
  var sum = 0
  for (const day of travel.days) {
    for (const refund of day.refunds) {
      sum += refund.refund.amount
    }
  }
  // baseCurrency
  return { amount: sum, currency: { _id: 'EUR' } }
}

function getExpensesSum(travel: Travel): Money {
  var sum = 0
  for (const stage of travel.stages) {
    if (stage.cost && stage.cost.amount > 0) {
      if (stage.cost.exchangeRate && typeof stage.cost.exchangeRate.amount == 'number') {
        sum += stage.cost.exchangeRate.amount
      } else {
        sum += stage.cost.amount
      }
    }
  }
  for (const expense of travel.expenses) {
    if (expense.cost && expense.cost.amount > 0) {
      if (expense.cost.exchangeRate && typeof expense.cost.exchangeRate.amount == 'number') {
        sum += expense.cost.exchangeRate.amount
      } else {
        sum += expense.cost.amount
      }
    }
  }
  // baseCurrency
  return { amount: sum, currency: { _id: 'EUR' } }
}

function getTravelTotal(travel: Travel): Money {
  var advance = 0
  if (travel.advance && travel.advance.amount) {
    advance = travel.advance.exchangeRate ? travel.advance.exchangeRate.amount : travel.advance.amount
  }
  // baseCurrency
  return { amount: getExpensesSum(travel).amount + getLumpSumsSum(travel).amount - advance, currency: { _id: 'EUR' } }
}

export {
  getFlagEmoji,
  getDiffInDays,
  getDayList,
  datetimeToDateString,
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
