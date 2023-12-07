import fs from 'fs'
import { readdir } from 'node:fs/promises'
import { CountryLumpSum } from '../../common/types.js'
import Country from '../models/country.js'

interface RawLumpSum {
  country: string
  catering8: string
  catering24: string
  overnight: string
}

interface RawLumpSumWithCities extends RawLumpSum {
  spezials?: {
    city: string
    catering8: string
    catering24: string
    overnight: string
  }[]
}

export type LumpSumsJSON = { data: LumpSumWithCountryCode[]; validFrom: number }[]
type LumpSumWithCountryCode = Omit<CountryLumpSum, 'validFrom'> & { countryCode: string }
type LumpSumWithCountryName = Omit<CountryLumpSum, 'validFrom'> & { country: string }

function isRawLumpSum(data: any): data is RawLumpSum {
  return typeof data.country === 'string'
}

function assertAreRawLumpSums(data: any[]): asserts data is RawLumpSum[] {
  for (const item of data) {
    if (!isRawLumpSum(item)) {
      throw TypeError('Raw lump sums are of wrong type: ' + item)
    }
  }
}

export async function parseLumpSumsFiles() {
  const lumpSums: LumpSumsJSON = []
  const files = await readdir('./data')
  for (const file of files) {
    const matched = file.match(/lumpSums_(\d{4}-\d{2}-\d{2})\.tsv/i)
    if (matched && matched.length > 1) {
      const dataStr = fs.readFileSync('./data/' + file, 'utf8')
      const validFrom = new Date(matched[1]).valueOf()
      const data = await parseRawLumpSums(dataStr)
      lumpSums.push({ validFrom, data })
    }
  }
  fs.writeFileSync('./data/lumpSums.json', JSON.stringify(lumpSums, undefined, 2), 'utf-8')
  return lumpSums
}

export async function parseRawLumpSums(dataStr: string): Promise<LumpSumWithCountryCode[]> {
  const refinedString = await fixTableSpezialties(dataStr)
  const data = csvToObjects(refinedString, '\t', ',', '')
  assertAreRawLumpSums(data)
  const rawLumpSums = combineSpezials(data)
  const lumpSums: LumpSumWithCountryCode[] = []
  for (const rawLumpSum of rawLumpSums) {
    lumpSums.push(await findCountryCode(convertRawLumpSum(rawLumpSum)))
  }
  return lumpSums
}

function combineSpezials(rawLumpSums: (RawLumpSum & { city?: string })[]): RawLumpSumWithCities[] {
  const general = /im Übrigen/i
  const spezialStart = /^–\s{2,}(.*)/i
  var spezials = []
  for (var i = rawLumpSums.length - 1; i >= 0; i--) {
    const matched = rawLumpSums[i].country.match(spezialStart)
    if (matched && matched.length > 1) {
      rawLumpSums[i].city = matched[1]
      delete (rawLumpSums[i] as any).country
      spezials.push(rawLumpSums[i])
      rawLumpSums.splice(i, 1)
    } else if (spezials.length > 0) {
      for (var j = spezials.length - 1; j >= 0; j--) {
        if (general.test(spezials[j].city as string)) {
          delete spezials[j].city
          Object.assign(rawLumpSums[i], spezials[j])
          spezials.splice(j, 1)
          break
        }
      }
      ;(rawLumpSums[i] as any).spezials = spezials
      spezials = []
    }
  }
  return rawLumpSums
}

async function findCountryCode(lumpSum: LumpSumWithCountryName, countryNameLanguage = 'de'): Promise<LumpSumWithCountryCode> {
  const conditions: any = {}
  conditions.$or = [{}, {}]
  conditions.$or[0]['name.' + countryNameLanguage] = lumpSum.country
  conditions.$or[1]['alias.' + countryNameLanguage] = lumpSum.country
  const country = await Country.findOne(conditions).lean()
  if (!country) {
    throw Error('"' + lumpSum.country + '" not found!')
  }
  const lumpSumWithCode: LumpSumWithCountryCode = Object.assign(lumpSum, { countryCode: country._id, country: undefined })
  return lumpSumWithCode
}

function convertRawLumpSum(raw: RawLumpSumWithCities): LumpSumWithCountryName {
  const spezials: CountryLumpSum['spezials'] = []
  if (raw.spezials) {
    for (const spezial of raw.spezials) {
      spezials.push({
        catering24: parseInt(spezial.catering24, 10),
        catering8: parseInt(spezial.catering8, 10),
        overnight: parseInt(spezial.overnight, 10),
        city: spezial.city
      })
    }
  }

  return {
    country: raw.country,
    catering24: parseInt(raw.catering24, 10),
    catering8: parseInt(raw.catering8, 10),
    overnight: parseInt(raw.overnight, 10),
    spezials
  }
}

/**
 * @returns Array of JS Objects
 */
export function csvToObjects(
  csv: string,
  separator = '\t',
  arraySeparator = ', ',
  resultForEmptyString: any = undefined
): { [key: string]: string | string[] }[] {
  var lines = csv.split('\n')
  var result = []
  var headers = lines[0].split(separator)
  for (var i = 1; i < lines.length; i++) {
    var obj: { [key: string]: string | string[] } = {}
    if (lines[i] === '') {
      break
    }
    var currentline = lines[i].split(separator)
    if (currentline.length !== headers.length) {
      throw Error('Line (#' + (i + 1) + ') has other length than header: ' + lines[i])
    }
    for (var j = 0; j < headers.length; j++) {
      // search for [] to identify arrays
      const match = currentline[j].match(/^\[(.*)\]$/)
      if (match === null) {
        if (currentline[j] === '') {
          obj[headers[j]] = resultForEmptyString
        } else {
          obj[headers[j]] = currentline[j]
        }
      } else {
        obj[headers[j]] = match[1].split(arraySeparator)
      }
    }
    result.push(obj)
  }
  return result
}

async function fixTableSpezialties(dataStr: string): Promise<string> {
  // Remove empty Lines
  var result = dataStr.replace(/^\t+\n/gm, '')

  // Remove line breaks inside quotes
  const lineBreaks = /".*(\n).*"/dgm
  var match: RegExpExecArray | null
  while ((match = lineBreaks.exec(result)) !== null) {
    if (match.indices) {
      const m = match.indices[1]
      result = result.slice(0, m[0]) + ' ' + result.slice(m[1])
    }
  }
  //Remove quotes
  var result = result.replace(/"/gm, '')

  return result
}
