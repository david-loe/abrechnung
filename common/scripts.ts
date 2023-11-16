import { ExpenseReport, HealthCareCost, Locale, Money, Place, Travel } from './types.js'

// TODO: Resolve this to settings from DB
const settings = {
  baseCurrency: {
    _id: 'EUR',
    flag: '🇪🇺',
    name: {
      de: 'Euro',
      en: 'euro'
    },
    subunit: 'Cent',
    symbol: '€'
  }
}

export function mailToLink(recipients: string[], subject?: string, body?: string, cc?: string[], bcc?: string[]): string {
  var paramString = ''
  function addParam(param: string, value: string) {
    if (value.length > 0) {
      if (paramString.length > 0) {
        paramString += '&' + param + '=' + value
      } else {
        paramString += '?' + param + '=' + value
      }
    }
  }
  if (cc) addParam('cc', cc.join(';'))
  if (bcc) addParam('bcc', bcc.join(';'))
  if (subject) addParam('subject', encodeURIComponent(subject))
  if (body) addParam('body', encodeURIComponent(body))
  return 'mailto:' + recipients.join(';') + paramString
}

export function msTeamsToLink(recipients: string[], message?: string, topicName?: string): string {
  var paramString = ''
  function addParam(param: string, value: string) {
    if (value.length > 0) {
      if (paramString.length > 0) {
        paramString += '&' + param + '=' + value
      } else {
        paramString += '?' + param + '=' + value
      }
    }
  }
  addParam('users', recipients.join(','))
  if (topicName) addParam('topicName', encodeURIComponent(topicName))
  if (message) addParam('message', encodeURIComponent(message))
  return 'https://teams.microsoft.com/l/chat/0/0' + paramString
}

export function getFlagEmoji(countryCode: string): string | null {
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

export function isValidDate(date: Date | string | number): Date | null {
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

export function datetimeToDateString(datetime: Date | string | number): string {
  const date = isValidDate(datetime)
  if (date) {
    return date.toISOString().slice(0, -14)
  } else {
    return ''
  }
}

export function datetimeToDatetimeString(datetime: Date | string | number): string {
  const date = isValidDate(datetime)
  if (date) {
    return date.toISOString().slice(0, -8)
  } else {
    return ''
  }
}

export function htmlInputStringToDateTime(dateTimeStr: string): Date | null {
  const date = isValidDate(dateTimeStr)
  if (date) {
    return new Date(date.valueOf() - date.getTimezoneOffset() * 60 * 1000)
  } else {
    return null
  }
}

export function datetimeToDate(datetime: Date | string | number): Date {
  return new Date(datetimeToDateString(datetime))
}

export function getDiffInDays(startDate: Date | string | number, endDate: Date | string | number): number {
  const firstDay = datetimeToDate(startDate)
  const lastDay = datetimeToDate(endDate)
  return (lastDay.valueOf() - firstDay.valueOf()) / (1000 * 60 * 60 * 24)
}

export function getDayList(startDate: Date | string | number, endDate: Date | string | number): Date[] {
  const days: Date[] = []
  for (var i = 0; i < getDiffInDays(startDate, endDate) + 1; i++) {
    days.push(new Date(datetimeToDate(startDate).valueOf() + i * 1000 * 60 * 60 * 24))
  }
  return days
}

export function getMoneyString(
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
    currency:
      useExchangeRate && money.exchangeRate
        ? settings.baseCurrency._id
        : typeof money.currency === 'string'
        ? money.currency
        : money.currency._id // baseCurrency
  })
}

export function getDetailedMoneyString(money: Money, locale: Locale, printZero = false): string {
  if (!money || (money && (typeof money.amount !== 'number' || (!money.amount && !printZero)))) {
    return ''
  }
  var str = money.amount!.toLocaleString(locale, {
    style: 'currency',
    currency: money.currency._id
  })
  if (money.exchangeRate && money.exchangeRate.rate) {
    str = str + ' / ' + money.exchangeRate.rate.toLocaleString(locale, { maximumFractionDigits: 4 }) + ' = '
    str =
      str +
      money.exchangeRate.amount.toLocaleString(locale, {
        style: 'currency',
        currency: settings.baseCurrency._id
      })
  }
  return str
}

export function placeToString(place: Place, locale: Locale = 'de'): string {
  return place.place + ', ' + place.country.name[locale] + place.country.flag
}

export function dateToTimeString(date: string | number | Date): string {
  const dateObject = isValidDate(date)
  if (dateObject) {
    const hour = dateObject.getUTCHours().toString().padStart(2, '0')
    const minute = dateObject.getUTCMinutes().toString().padStart(2, '0')
    return hour + ':' + minute
  } else {
    return ''
  }
}

export function datetoDateString(date: string | number | Date): string {
  const dateObject = isValidDate(date)
  if (dateObject) {
    const month = (dateObject.getUTCMonth() + 1).toString().padStart(2, '0')
    const day = dateObject.getUTCDate().toString().padStart(2, '0')
    return day + '.' + month
  } else {
    return ''
  }
}

export function dateTimeToString(datetime: string | number | Date): string {
  return datetoDateString(datetime) + ' ' + dateToTimeString(datetime)
}

export function datetoDateStringWithYear(date: string | number | Date): string {
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

export function getLumpSumsSum(travel: Travel): Money {
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

export function getExpensesSum(travel: Travel): Money {
  var sum = 0
  for (const stage of travel.stages) {
    if (stage.cost && stage.cost.amount != null) {
      var add = 0
      if (stage.cost.exchangeRate && typeof stage.cost.exchangeRate.amount == 'number') {
        add = stage.cost.exchangeRate.amount
      } else {
        add = stage.cost.amount
      }
      if (stage.purpose === 'mixed') {
        add = add * travel.professionalShare!
      }
      sum += add
    }
  }
  for (const expense of travel.expenses) {
    if (expense.cost && expense.cost.amount != null) {
      var add = 0
      if (expense.cost.exchangeRate && typeof expense.cost.exchangeRate.amount == 'number') {
        add = expense.cost.exchangeRate.amount
      } else {
        add = expense.cost.amount
      }
      if (expense.purpose === 'mixed') {
        add = add * travel.professionalShare!
      }
      sum += add
    }
  }
  return { amount: sum, currency: settings.baseCurrency }
}

export function getTravelTotal(travel: Travel): Money {
  var advance = 0
  if (travel.advance && travel.advance.amount != null) {
    advance = travel.advance.exchangeRate ? travel.advance.exchangeRate.amount : travel.advance.amount
  }
  return { amount: getExpensesSum(travel).amount! + getLumpSumsSum(travel).amount! - advance, currency: settings.baseCurrency }
}

export function getExpenseReportTotal(expenseReport: ExpenseReport): Money {
  var sum = 0
  for (const expense of expenseReport.expenses) {
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

export function getHealthCareCostTotal(healthCareCost: HealthCareCost): Money {
  var sum = 0
  for (const expense of healthCareCost.expenses) {
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

// From https://stackoverflow.com/a/52983833/13582326
export function resizeImage(file: Blob, longestSide: number): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = function (this: FileReader) {
      // We create an image to receive the Data URI
      var img = document.createElement('img')
      // When the img "onload" is triggered we can resize the image.
      img.onload = function (this: GlobalEventHandlers) {
        // We create a canvas and get its context.
        var canvas = document.createElement('canvas')
        var ctx = canvas.getContext('2d')
        // We set the dimensions to the wanted size.
        var max: 'width' | 'height' = img.height < img.width ? 'width' : 'height'
        var min: 'width' | 'height' = max == 'width' ? 'height' : 'width'
        if (img[max] > longestSide) {
          canvas[max] = longestSide
          canvas[min] = img[min] * (longestSide / img[max])
        } else {
          return resolve(file)
        }
        // We resize the image with the canvas method drawImage();
        ;(ctx as CanvasRenderingContext2D).drawImage(this as CanvasImageSource, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => resolve(blob as Blob), 'image/jpeg', 0.85)
      }
      // We put the Data URI in the image's src attribute
      img.src = this.result as string
    }
  })
}
