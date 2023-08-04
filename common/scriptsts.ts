import { Currency, DocumentFile, Locale, Money, Place, Travel } from './types'
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

async function fileEventToDocumentFiles(event: Event): Promise<DocumentFile[] | null> {
  const files: DocumentFile[] = []
  if (event.target && (event.target as HTMLInputElement).files) {
    for (const file of (event.target as HTMLInputElement).files!) {
      if (file.size < 16000000) {
        if (file.type.indexOf('image') > -1) {
          files.push({ data: await resizeImage(file, 1400), type: file.type as DocumentFile['type'], name: file.name })
        } else {
          files.push({ data: file, type: file.type as DocumentFile['type'], name: file.name })
        }
      } else {
        alert('alerts.imageToBig ' + file.name)
      }
    }
    ;(event.target as HTMLInputElement).value = ''
    return files
  }
  return null
}

// From https://stackoverflow.com/a/52983833/13582326
function resizeImage(file: Blob, longestSide: number): Promise<Blob> {
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
  getTravelTotal,
  fileEventToDocumentFiles
}
