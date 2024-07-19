import { Country, CountryCode, LumpSum } from './types.js'

export default class LumpSumCalculator {
  fallBackLumpSumCountry: CountryCode
  getCountryById: (id: CountryCode) => Promise<Country>

  constructor(getCountryById: (id: CountryCode) => Promise<Country>, fallBackLumpSumCountry: CountryCode) {
    this.getCountryById = getCountryById
    this.fallBackLumpSumCountry = fallBackLumpSumCountry
  }
  async getLumpSum(country: Country, date: Date, special: string | undefined = undefined): Promise<LumpSum> {
    if (country.lumpSumsFrom) {
      const lumpSumFrom = await this.getCountryById(country.lumpSumsFrom)
      return this.getLumpSum(lumpSumFrom, date)
    } else if (country.lumpSums.length == 0) {
      const fallBackLumpSumCountry = await this.getCountryById(this.fallBackLumpSumCountry)
      return this.getLumpSum(fallBackLumpSumCountry, date)
    } else {
      var nearest = 0
      for (var i = 0; i < country.lumpSums.length; i++) {
        var diff = date.valueOf() - (country.lumpSums[i].validFrom as Date).valueOf()
        if (diff >= 0 && diff < date.valueOf() - (country.lumpSums[nearest].validFrom as Date).valueOf()) {
          nearest = i
        }
      }
      if (date.valueOf() - (country.lumpSums[nearest].validFrom as Date).valueOf() < 0) {
        throw new Error('No valid lumpSum found for Country: ' + country._id + ' for date: ' + date)
      }
      if (special && country.lumpSums[nearest].specials) {
        for (const lumpSumSpecial of country.lumpSums[nearest].specials!) {
          if (lumpSumSpecial.city === special) {
            return lumpSumSpecial
          }
        }
      }
      return country.lumpSums[nearest]
    }
  }
}
