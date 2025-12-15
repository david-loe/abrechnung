import { Country, CountryCode, CountryLumpSum, LumpSumWithSpecials } from '../types.js'

export type LumpSumsJSON = { data: LumpSumWithCountryCode[]; validFrom: string; validUntil: string | null }[]
type LumpSumWithCountryCode = LumpSumWithSpecials & { countryCode: string }
export async function addLumpSumsToCountries(
  lumpSumsJSON: LumpSumsJSON,
  getCountryById: (id: CountryCode) => Promise<Country | null>,
  saveNewCountry: (country: Country) => Promise<unknown>
) {
  lumpSumsJSON.sort((a, b) => new Date(a.validFrom).valueOf() - new Date(b.validFrom).valueOf())
  for (const lumpSums of lumpSumsJSON) {
    const validFrom = new Date(lumpSums.validFrom).valueOf()
    for (const lumpSum of lumpSums.data) {
      const country = await getCountryById(lumpSum.countryCode)
      if (country) {
        let newData = true
        for (const countrylumpSums of country.lumpSums) {
          if ((countrylumpSums.validFrom as Date).valueOf() >= validFrom) {
            newData = false
            break
          }
        }
        if (newData) {
          const newLumpSum: CountryLumpSum = {
            ...lumpSum,
            validFrom: new Date(lumpSums.validFrom),
            validUntil: lumpSums.validUntil ? new Date(lumpSums.validUntil) : null
          }
          country.lumpSums.push(newLumpSum)
          await saveNewCountry(country)
        }
      } else {
        throw new Error(`No Country with id "${lumpSum.countryCode}" found`)
      }
    }
  }
}

export function getSpecialLumpSumsList(countries: Country[]) {
  const specialCountries: { [key: CountryCode]: string[] } = {}
  for (const c of countries) {
    const specials: string[] = []
    for (const lumpSum of c.lumpSums) {
      if (lumpSum.specials) {
        for (const special of lumpSum.specials) {
          if (specials.indexOf(special.city) === -1) {
            specials.push(special.city)
          }
        }
      }
    }
    if (specials.length > 0) {
      specialCountries[c._id] = specials
    }
  }
  return specialCountries
}
