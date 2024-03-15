import {
  ExpenseReport,
  HealthCareCost,
  Locale,
  Money,
  Place,
  Travel,
  baseCurrency,
  reportIsHealthCareCost,
  reportIsTravel
} from './types.js'

export function getById<T extends { _id: string }>(id: string, array: T[]): T | null {
  for (const item of array) {
    if (item._id === id) {
      return item
    }
  }
  return null
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
  locale: Locale = 'de',
  warning: boolean = false
): string {
  var amount = 0
  var currency = typeof money.currency === 'string' ? money.currency : money.currency._id
  if (useExchangeRate && money.exchangeRate) {
    amount = money.exchangeRate.amount
    currency = baseCurrency._id
  } else {
    if (money.amount !== null) {
      amount = money.amount
    }
    if (useExchangeRate && !money.exchangeRate && currency !== baseCurrency._id) {
      warning = true
    }
  }
  return (
    func(amount).toLocaleString(locale, {
      style: 'currency',
      currency: currency
    }) + (warning ? ' ⚠' : '')
  )
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
        currency: baseCurrency._id
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
  return { amount: sum, currency: baseCurrency }
}

function getBaseCurrencyAmount(a: Money): number {
  var amount = 0
  if (a.amount !== null) {
    if (a.exchangeRate && typeof a.exchangeRate.amount == 'number') {
      amount += a.exchangeRate.amount
    } else if (a.currency._id == baseCurrency._id) {
      amount += a.amount
    }
  }
  return amount
}

export function getExpensesSum(travel: Travel): Money {
  var sum = 0
  for (const stage of travel.stages) {
    if (stage.cost && stage.cost.amount != null) {
      var add = getBaseCurrencyAmount(stage.cost)
      if (stage.purpose === 'mixed') {
        add = add * travel.professionalShare!
      }
      sum += add
    }
  }
  for (const expense of travel.expenses) {
    if (expense.cost && expense.cost.amount != null) {
      var add = getBaseCurrencyAmount(expense.cost)
      if (expense.purpose === 'mixed') {
        add = add * travel.professionalShare!
      }
      sum += add
    }
  }
  return { amount: sum, currency: baseCurrency }
}

export function getTotal(report: Travel | ExpenseReport | HealthCareCost): Money {
  if (reportIsTravel(report)) {
    return getTravelTotal(report)
  } else if (reportIsHealthCareCost(report)) {
    return getHealthCareCostTotal(report)
  } else {
    return getExpenseReportTotal(report)
  }
}

export function getTravelTotal(travel: Travel): Money {
  var advance = 0
  if (travel.advance && travel.advance.amount != null) {
    advance = getBaseCurrencyAmount(travel.advance)
  }
  return { amount: getExpensesSum(travel).amount! + getLumpSumsSum(travel).amount! - advance, currency: baseCurrency }
}

export function getExpenseReportTotal(expenseReport: ExpenseReport): Money {
  var sum = 0
  for (const expense of expenseReport.expenses) {
    if (expense.cost && expense.cost.amount != null) {
      sum += getBaseCurrencyAmount(expense.cost)
    }
  }
  return { amount: sum, currency: baseCurrency }
}

export function getHealthCareCostTotal(healthCareCost: HealthCareCost): Money {
  var sum = 0
  for (const expense of healthCareCost.expenses) {
    if (expense.cost && expense.cost.amount != null) {
      sum += getBaseCurrencyAmount(expense.cost)
    }
  }
  return { amount: sum, currency: baseCurrency }
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

export class Base64 {
  static #keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

  static encode(input: string): string {
    var output = ''
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4
    var i = 0

    input = this.#utf8_encode(input)

    while (i < input.length) {
      chr1 = input.charCodeAt(i++)
      chr2 = input.charCodeAt(i++)
      chr3 = input.charCodeAt(i++)

      enc1 = chr1 >> 2
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4)
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6)
      enc4 = chr3 & 63

      if (isNaN(chr2)) {
        enc3 = enc4 = 64
      } else if (isNaN(chr3)) {
        enc4 = 64
      }

      output = output + this.#keyStr.charAt(enc1) + this.#keyStr.charAt(enc2) + this.#keyStr.charAt(enc3) + this.#keyStr.charAt(enc4)
    }

    return output
  }

  static decode(input: string): string {
    var output = ''
    var chr1, chr2, chr3
    var enc1, enc2, enc3, enc4
    var i = 0

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '')

    while (i < input.length) {
      enc1 = this.#keyStr.indexOf(input.charAt(i++))
      enc2 = this.#keyStr.indexOf(input.charAt(i++))
      enc3 = this.#keyStr.indexOf(input.charAt(i++))
      enc4 = this.#keyStr.indexOf(input.charAt(i++))

      chr1 = (enc1 << 2) | (enc2 >> 4)
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
      chr3 = ((enc3 & 3) << 6) | enc4

      output = output + String.fromCharCode(chr1)

      if (enc3 != 64) {
        output = output + String.fromCharCode(chr2)
      }
      if (enc4 != 64) {
        output = output + String.fromCharCode(chr3)
      }
    }

    output = this.#utf8_decode(output)

    return output
  }

  static #utf8_encode(string: string): string {
    string = string.replace(/\r\n/g, '\n')
    var utftext = ''

    for (var n = 0; n < string.length; n++) {
      var c = string.charCodeAt(n)

      if (c < 128) {
        utftext += String.fromCharCode(c)
      } else if (c > 127 && c < 2048) {
        utftext += String.fromCharCode((c >> 6) | 192)
        utftext += String.fromCharCode((c & 63) | 128)
      } else {
        utftext += String.fromCharCode((c >> 12) | 224)
        utftext += String.fromCharCode(((c >> 6) & 63) | 128)
        utftext += String.fromCharCode((c & 63) | 128)
      }
    }

    return utftext
  }

  static #utf8_decode(utftext: string): string {
    var string = ''
    var i = 0
    var c,
      c2,
      c3 = 0

    while (i < utftext.length) {
      c = utftext.charCodeAt(i)

      if (c < 128) {
        string += String.fromCharCode(c)
        i++
      } else if (c > 191 && c < 224) {
        c2 = utftext.charCodeAt(i + 1)
        string += String.fromCharCode(((c & 31) << 6) | (c2 & 63))
        i += 2
      } else {
        c2 = utftext.charCodeAt(i + 1)
        c3 = utftext.charCodeAt(i + 2)
        string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63))
        i += 3
      }
    }

    return string
  }
}
