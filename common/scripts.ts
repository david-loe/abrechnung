import Formatter from './formatter.js'
import {
  _id,
  AddUp,
  BaseCurrencyMoney,
  baseCurrency,
  binary,
  ExpenseReport,
  FlatAddUp,
  HealthCareCost,
  HexColor,
  idDocumentToId,
  Locale,
  Money,
  Place,
  ProjectSimple,
  reportIsTravel,
  Travel,
  TravelDay
} from './types.js'

export function PlaceToString(place: Place, language?: Locale) {
  return `${place.place}, ${language ? place.country.name[language] : place.country._id}${place.country.flag ? ` ${place.country.flag}` : ''}`
}

export function getById<T extends { _id: string }>(id: string, array: T[]): T | null {
  for (const item of array) {
    if (item._id === id) {
      return item
    }
  }
  return null
}

export function mailToLink(recipients: string[], subject?: string, body?: string, cc?: string[], bcc?: string[]): string {
  let paramString = ''
  function addParam(param: string, value: string) {
    if (value.length > 0) {
      if (paramString.length > 0) {
        paramString += `&${param}=${value}`
      } else {
        paramString += `?${param}=${value}`
      }
    }
  }
  if (cc) addParam('cc', cc.join(';'))
  if (bcc) addParam('bcc', bcc.join(';'))
  if (subject) addParam('subject', encodeURIComponent(subject))
  if (body) addParam('body', encodeURIComponent(body))
  return `mailto:${recipients.join(';')}${paramString}`
}

export function msTeamsToLink(recipients: string[], message?: string, topicName?: string): string {
  let paramString = ''
  function addParam(param: string, value: string) {
    if (value.length > 0) {
      if (paramString.length > 0) {
        paramString += `&${param}=${value}`
      } else {
        paramString += `?${param}=${value}`
      }
    }
  }
  addParam('users', recipients.join(','))
  if (topicName) addParam('topicName', encodeURIComponent(topicName))
  if (message) addParam('message', encodeURIComponent(message))
  return `https://teams.microsoft.com/l/chat/0/0${paramString}`
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
  if (Number.isNaN(d.valueOf())) {
    return null
  }
  return d
}

export function datetimeToDateString(datetime: Date | string | number): string {
  const date = isValidDate(datetime)
  if (date) {
    return date.toISOString().slice(0, -14)
  }
  return ''
}

export function datetimeToDatetimeString(datetime: Date | string | number): string {
  const date = isValidDate(datetime)
  if (date) {
    return date.toISOString().slice(0, -8)
  }
  return ''
}

export function htmlInputStringToDateTime(dateTimeStr: string): Date | null {
  const date = isValidDate(dateTimeStr)
  if (date) {
    return new Date(date.valueOf() - date.getTimezoneOffset() * 60 * 1000)
  }
  return null
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
  for (let i = 0; i < getDiffInDays(startDate, endDate) + 1; i++) {
    days.push(new Date(datetimeToDate(startDate).valueOf() + i * 1000 * 60 * 60 * 24))
  }
  return days
}

export function baseCurrencyMoneyToMoney(basic: BaseCurrencyMoney): Money {
  return Object.assign({ currency: baseCurrency }, basic)
}

export function getLumpSumsSum(days: TravelDay<_id>[]) {
  let sum = 0
  for (const day of days) {
    sum += day.lumpSums.overnight.refund.amount
    sum += day.lumpSums.catering.refund.amount
  }
  return { amount: sum }
}

export function getTotalBalance(addUps: FlatAddUp<_id>[]) {
  return addUps.reduce((sum, a) => sum + a.balance.amount, 0)
}

export function getTotalTotal(addUps: FlatAddUp<_id>[]) {
  return addUps.reduce((sum, a) => sum + a.total.amount, 0)
}

export function getAddUpTableData(formatter: Formatter, addUps: AddUp<_id>[], withLumpSums = false) {
  const hasAdvance = addUps.some((addUp) => addUp.advance.amount > 0)
  const showExpenses = withLumpSums || hasAdvance
  const summary: string[][] = []
  if (addUps.length > 1) {
    summary.push(['labels.project'])
  }
  if (showExpenses) {
    summary.push(['labels.expenses'])
  }
  if (withLumpSums) {
    summary.push(['labels.lumpSums'])
  }
  if (hasAdvance) {
    summary.push(['labels.advance'])
  }
  summary.push(['labels.balance'])
  for (let i = 0; i < addUps.length; i++) {
    let j = 0
    if (addUps.length > 1) {
      summary[j++].push(addUps[i].project.identifier)
    }
    if (showExpenses) {
      summary[j++].push(formatter.baseCurrency(addUps[i].expenses.amount))
    }
    if (withLumpSums) {
      summary[j++].push(formatter.baseCurrency((addUps[i] as AddUp<_id, Travel<_id, binary>>).lumpSums.amount))
    }
    if (hasAdvance) {
      summary[j++].push(
        addUps[i].advance.amount > 0
          ? formatter.baseCurrency(-1 * (addUps[i].advanceOverflow ? addUps[i].total.amount : addUps[i].advance.amount))
          : ''
      )
    }
    summary[j++].push(formatter.baseCurrency(addUps[i].balance.amount))
  }
  return summary
}

export function getBaseCurrencyAmount(a: Money): number {
  let amount = 0
  if (a.amount !== null) {
    const currency = idDocumentToId(a.currency)
    if (currency === baseCurrency._id) {
      amount = a.amount
    } else if (a.exchangeRate && typeof a.exchangeRate.amount === 'number') {
      amount = a.exchangeRate.amount
    }
  }
  return amount
}

function defaultAddUp<idType extends _id>(projectId: idType, withLumpSums: true): FlatAddUp<idType, Travel<idType, binary>>
function defaultAddUp<idType extends _id>(
  projectId: idType,
  withLumpSums: false
): FlatAddUp<idType, ExpenseReport<idType, binary> | HealthCareCost<idType, binary>>
function defaultAddUp<idType extends _id>(projectId: idType, withLumpSums: boolean): FlatAddUp<idType>
function defaultAddUp<idType extends _id>(projectId: idType, withLumpSums = false): FlatAddUp<idType> {
  return {
    project: projectId,
    balance: { amount: 0 },
    total: { amount: 0 },
    advance: { amount: 0 },
    expenses: { amount: 0 },
    ...(withLumpSums && { lumpSums: { amount: 0 } }),
    advanceOverflow: false
  }
}

function addToAddUps<idType extends _id>(
  addUps: FlatAddUp<idType>[],
  add: number,
  key: 'balance' | 'total' | 'advance' | 'expenses' | 'lumpSums',
  project: ProjectSimple<idType> | undefined | null,
  isTravel = false
): void {
  if (project) {
    const projectId = idDocumentToId(project)
    const addUp = addUps.find((addUp) => idDocumentToId<idType>(addUp.project).toString() === projectId.toString())
    if (addUp) {
      if (key in addUp) {
        ;(addUp as FlatAddUp<idType, Travel<_id, binary>>)[key].amount += add
      }
    } else {
      const newAddUp = defaultAddUp(projectId, isTravel)
      if (key in newAddUp) {
        ;(newAddUp as FlatAddUp<idType, Travel<_id, binary>>)[key].amount += add
      }
      addUps.push(newAddUp)
    }
  } else {
    if (key in addUps[0]) {
      ;(addUps[0] as FlatAddUp<idType, Travel<_id, binary>>)[key].amount += add
    }
  }
}

function addTravelExpensesSum<idType extends _id>(travel: Travel<idType, binary>, addUps: FlatAddUp<idType, Travel<idType, binary>>[]) {
  for (const stage of travel.stages) {
    if (stage.cost && stage.cost.amount !== null) {
      let add = getBaseCurrencyAmount(stage.cost)
      if (stage.purpose === 'mixed' && travel.professionalShare) {
        add = add * travel.professionalShare
      }
      addToAddUps(addUps, add, 'expenses', stage.project, true)
    }
  }
  for (const expense of travel.expenses) {
    if (expense.cost && expense.cost.amount !== null) {
      let add = getBaseCurrencyAmount(expense.cost)
      if (expense.purpose === 'mixed' && travel.professionalShare) {
        add = add * travel.professionalShare
      }
      addToAddUps(addUps, add, 'expenses', expense.project, true)
    }
  }
}

export function addUp<
  idType extends _id,
  T extends Travel<idType, binary> | ExpenseReport<idType, binary> | HealthCareCost<idType, binary>
>(report: T): FlatAddUp<idType, T>[] {
  const isTravel = reportIsTravel(report)
  const addUps = [defaultAddUp(idDocumentToId(report.project), isTravel) as FlatAddUp<idType, T>]
  if (reportIsTravel(report)) {
    ;(addUps[0] as FlatAddUp<idType, Travel<_id, binary>>).lumpSums = getLumpSumsSum(report.days)
    addTravelExpensesSum(report, addUps as FlatAddUp<idType, Travel<_id, binary>>[])
  } else {
    for (const expense of report.expenses) {
      addToAddUps(addUps, getBaseCurrencyAmount(expense.cost), 'expenses', expense.project, isTravel)
    }
  }
  for (const approvedAdvance of report.advances) {
    addToAddUps(addUps, approvedAdvance.balance.amount, 'advance', approvedAdvance.project, isTravel)
  }
  for (const addUp of addUps) {
    addUp.total.amount = addUp.expenses.amount + ((addUp as FlatAddUp<idType, Travel<_id, binary>>).lumpSums?.amount || 0)
    let balanceAmount = addUp.total.amount - addUp.advance.amount
    if (balanceAmount < 0) {
      addUp.advanceOverflow = true
      balanceAmount = 0
    }
    addUp.balance.amount = balanceAmount
  }

  return addUps
}

export function sanitizeFilename(filename: string) {
  // Liste der unsicheren Zeichen, die in Dateinamen nicht erlaubt sind
  const unsafeChars = /[<>:"/\\|?*\0]/g
  const sanitized = filename.replace(unsafeChars, '_')
  // Entfernen von führenden oder abschließenden Leerzeichen
  const trimmed = sanitized.trim()
  // Windows-Dateinamen dürfen nicht mit einem Punkt oder einer Leerstelle enden
  const finalName = trimmed.replace(/[.\s]+$/g, '')
  return finalName
}

// biome-ignore lint/complexity/noStaticOnlyClass: This class is intentionally static-only to provide utility methods without requiring instantiation
export class Base64 {
  static #keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

  static encode(input: string): string {
    let output = ''
    let chr1: number
    let chr2: number
    let chr3: number
    let enc1: number
    let enc2: number
    let enc3: number
    let enc4: number
    let i = 0

    const inputUTF8Save = Base64.#utf8_encode(input)

    while (i < inputUTF8Save.length) {
      chr1 = inputUTF8Save.charCodeAt(i++)
      chr2 = inputUTF8Save.charCodeAt(i++)
      chr3 = inputUTF8Save.charCodeAt(i++)

      enc1 = chr1 >> 2
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4)
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6)
      enc4 = chr3 & 63

      if (Number.isNaN(chr2)) {
        enc3 = enc4 = 64
      } else if (Number.isNaN(chr3)) {
        enc4 = 64
      }

      output =
        output + Base64.#keyStr.charAt(enc1) + Base64.#keyStr.charAt(enc2) + Base64.#keyStr.charAt(enc3) + Base64.#keyStr.charAt(enc4)
    }

    return output
  }

  static decode(input: string): string {
    let output = ''
    let chr1: number
    let chr2: number
    let chr3: number
    let enc1: number
    let enc2: number
    let enc3: number
    let enc4: number
    let i = 0

    const validBase64Input = input.replace(/[^A-Za-z0-9+/=]/g, '')

    while (i < validBase64Input.length) {
      enc1 = Base64.#keyStr.indexOf(validBase64Input.charAt(i++))
      enc2 = Base64.#keyStr.indexOf(validBase64Input.charAt(i++))
      enc3 = Base64.#keyStr.indexOf(validBase64Input.charAt(i++))
      enc4 = Base64.#keyStr.indexOf(validBase64Input.charAt(i++))

      chr1 = (enc1 << 2) | (enc2 >> 4)
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
      chr3 = ((enc3 & 3) << 6) | enc4

      output = output + String.fromCharCode(chr1)

      if (enc3 !== 64) {
        output = output + String.fromCharCode(chr2)
      }
      if (enc4 !== 64) {
        output = output + String.fromCharCode(chr3)
      }
    }

    output = Base64.#utf8_decode(output)

    return output
  }

  static #utf8_encode(string: string): string {
    const stringLineBreakCleaned = string.replace(/\r\n/g, '\n')
    let utftext = ''

    for (let n = 0; n < stringLineBreakCleaned.length; n++) {
      const c = stringLineBreakCleaned.charCodeAt(n)

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
    let string = ''
    let i = 0
    let c: number
    let c2: number
    let c3 = 0

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

/**
 * Simple object check.
 *
 * DOESN'T MAKE mongoose ObjectId AN OBJECT
 */
function isObject(item: unknown) {
  return item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date) && !('_bsontype' in item)
}

/**
 * Deep merge two objects.
 */
// biome-ignore lint/suspicious/noExplicitAny: generic function
export function mergeDeep(target: any, ...sources: any[]) {
  if (!sources.length) return target
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!isObject(target[key])) {
          Object.assign(target, { [key]: {} })
        }
        mergeDeep(target[key], source[key])
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return mergeDeep(target, ...sources)
}

function csvToArray(text: string, separator = ',', escapeChar = '"') {
  let p = ''
  let row = ['']
  const ret = [row]
  let i = 0
  let r = 0
  let s = !0
  for (let l of text) {
    if (escapeChar === l) {
      if (s && l === p) row[i] += l
      s = !s
    } else if (separator === l && s) l = row[++i] = ''
    else if ('\n' === l && s) {
      if ('\r' === p) row[i] = row[i].slice(0, -1)
      l = ''
      row = ret[++r] = [l]
      i = 0
    } else row[i] += l
    p = l
  }
  //remove empty rows
  for (let i = ret.length - 1; i >= 0; i--) {
    if (ret[i].length === 1 && ret[i][0] === '') {
      ret.splice(i, 1)
    }
  }
  return ret
}

// biome-ignore lint/suspicious/noExplicitAny: generic function
type ValueType = any
export function csvToObjects(
  csv: string,
  transformer: { [key: string]: (val: string | undefined) => ValueType } = {},
  separator = ',',
  arraySeparator = ',',
  pathSeparator = '.',
  escapeChar = '"'
) {
  const lines = csvToArray(csv, separator, escapeChar)
  const result = []
  if (lines.length > 1) {
    const headers = lines[0]
    for (let i = 1; i < lines.length; i++) {
      const obj: Record<string, ValueType> = {}
      const currentline = lines[i]
      for (let j = 0; j < headers.length; j++) {
        let object = obj
        const valStr = currentline[j] !== '' ? currentline[j] : undefined
        let val: ValueType = valStr
        const pathParts = headers[j].split(pathSeparator)
        for (let k = 0; k < pathParts.length - 1; k++) {
          if (!isObject(object[pathParts[k]])) {
            object[pathParts[k]] = {}
          }
          object = object[pathParts[k]] as Record<string, ValueType>
        }
        const key = pathParts[pathParts.length - 1]
        // search for [] to identify arrays
        const match = currentline[j].match(/^\[(.*)\]$/)
        if (match === null) {
          if (transformer[headers[j]]) {
            val = transformer[headers[j]](valStr)
          }
        } else {
          const split = match[1].split(arraySeparator)
          if (transformer[headers[j]]) {
            val = split.map(transformer[headers[j]])
          }
        }
        object[key] = val
      }
      result.push(obj)
    }
  }
  return result
}

export function detectSeparator(csvString: string, fallBackSeparator: '\t' | ';' | ',' = ','): '\t' | ';' | ',' {
  const lines = csvString.split(/\r?\n/)

  let firstNonEmptyLine: string | undefined
  for (const line of lines) {
    if (line.trim() !== '') {
      firstNonEmptyLine = line
      break
    }
  }
  if (!firstNonEmptyLine) {
    return fallBackSeparator
  }

  const counts = {
    '\t': (firstNonEmptyLine.match(/\t/g) || []).length,
    ';': (firstNonEmptyLine.match(/;/g) || []).length,
    ',': (firstNonEmptyLine.match(/,/g) || []).length
  }

  let maxCount = -1
  let chosen: '\t' | ';' | ',' = fallBackSeparator
  for (const sep of ['\t', ';', ','] as const) {
    if (counts[sep] > maxCount) {
      maxCount = counts[sep]
      chosen = sep
    }
  }

  return chosen
}

export function convertGermanDateToHTMLDate(val: string | undefined) {
  if (val) {
    const match = val.match(/^(?<d>[0-3]?\d)\.(?<m>[0-1]?\d).(?<y>\d\d\d\d)$/)
    if (match?.groups) {
      return `${match.groups.y}-${match.groups.m.padStart(2, '0')}-${match.groups.d.padStart(2, '0')}`
    }
  }
  return val
}

export function objectsToCSV(objects: Record<string, unknown>[], separator = '\t', arraySeparator = ', '): string {
  let keys: string[] = []
  for (const obj of objects) {
    const oKeys = Object.keys(obj)
    if (keys.length < oKeys.length) {
      keys = oKeys
    }
  }
  let str = `${keys.join(separator)}\n`
  for (const obj of objects) {
    const col: string[] = []
    for (const key of keys) {
      if (!(key in obj)) {
        col.push('')
      } else if (Array.isArray(obj[key])) {
        col.push(`[${obj[key].join(arraySeparator)}]`)
      } else if (obj[key] === null) {
        col.push('null')
      } else {
        col.push(String(obj[key]))
      }
    }
    str += `${col.join(separator)}\n`
  }
  return str
}

export function download(file: File) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(file)

  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()

  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export function hexToRGB(hex: HexColor): [number, number, number] {
  // Entferne das '#' falls vorhanden
  let hexChars = hex.replace(/^#/, '')

  // Falls shorthand (#abc), erweitern auf #aabbcc
  if (hexChars.length === 3) {
    hexChars = hexChars
      .split('')
      .map((char) => char + char)
      .join('')
  }

  if (hexChars.length !== 6) {
    throw new Error('Ungültiger Hex-Farbcode')
  }

  const red = Number.parseInt(hexChars.slice(0, 2), 16)
  const green = Number.parseInt(hexChars.slice(2, 4), 16)
  const blue = Number.parseInt(hexChars.slice(4, 6), 16)

  return [red, green, blue]
}
