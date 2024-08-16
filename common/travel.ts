import { datetimeToDate, getDayList, getDiffInDays } from './scripts.js'
import {
  baseCurrency,
  Country,
  CountryCode,
  CountrySimple,
  LumpSum,
  Meal,
  Place,
  PurposeSimple,
  Refund,
  SettingsTravel,
  Stage,
  Travel,
  TravelDayFullCountry,
  TravelExpense
} from './types.js'

export class TravelCalculator {
  getCountryById: (id: CountryCode) => Promise<Country>
  lumpSumCalculator!: LumpSumCalculator
  validator: TravelValidator
  travelSettings!: SettingsTravel
  stagesCompareFn = (a: Stage, b: Stage) => new Date(a.departure).valueOf() - new Date(b.departure).valueOf()
  expensesCompareFn = (a: TravelExpense, b: TravelExpense) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()

  constructor(getCountryById: (id: CountryCode) => Promise<Country>, travelSettings: SettingsTravel) {
    this.getCountryById = getCountryById
    this.lumpSumCalculator = new LumpSumCalculator(this.getCountryById, travelSettings.fallBackLumpSumCountry)
    this.validator = new TravelValidator(travelSettings)
    this.updateSettings(travelSettings)
  }

  async calc(travel: Travel): Promise<Invalid[]> {
    this.sort(travel)
    const conflicts = this.validator.validate(travel)
    if (conflicts.length === 0) {
      this.calculateProgress(travel)
      await this.calculateDays(travel)
      this.calculateProfessionalShare(travel)
      this.calculateRefundforOwnCar(travel)
      await this.addCateringRefunds(travel)
      await this.addOvernightRefunds(travel)
    }
    return conflicts
  }

  updateSettings(travelSettings: SettingsTravel) {
    this.travelSettings = travelSettings
    this.validator.updateSettings(travelSettings)
    this.lumpSumCalculator.setFallBackLumpSumCountry(travelSettings.fallBackLumpSumCountry)
  }

  sort(travel: Travel) {
    travel.stages.sort(this.stagesCompareFn)
    travel.expenses.sort(this.expensesCompareFn)
  }

  calculateProgress(travel: Travel) {
    if (travel.stages.length > 0) {
      var approvedLength = getDiffInDays(travel.startDate, travel.endDate) + 1
      var stageLength = getDiffInDays(travel.stages[0].departure, travel.stages[travel.stages.length - 1].arrival) + 1
      if (stageLength >= approvedLength) {
        travel.progress = 100
      } else {
        travel.progress = Math.round((stageLength / approvedLength) * 100)
      }
    } else {
      travel.progress = 0
    }
  }

  getDays(travel: Travel) {
    if (travel.stages.length > 0) {
      const days = getDayList(travel.stages[0].departure, travel.stages[travel.stages.length - 1].arrival)
      const newDays: { date: Date; cateringNoRefund?: { [key in Meal]: boolean }; purpose?: PurposeSimple; refunds: Refund[] }[] = days.map(
        (d) => {
          return { date: d, refunds: [] }
        }
      )
      for (const oldDay of travel.days) {
        for (const newDay of newDays) {
          if (new Date(oldDay.date).valueOf() - new Date(newDay.date!).valueOf() == 0) {
            newDay.cateringNoRefund = oldDay.cateringNoRefund
            newDay.purpose = oldDay.purpose
            break
          }
        }
      }
      return newDays
    } else {
      return []
    }
  }

  getBorderCrossings(travel: Travel) {
    const borderCrossings: { date: Date; country: { _id: CountryCode }; special?: string }[] = []
    if (travel.stages.length > 0) {
      const startCountry = travel.stages[0].startLocation.country
      borderCrossings.push({ date: new Date(travel.stages[0].departure), country: startCountry })

      for (var i = 0; i < travel.stages.length; i++) {
        const stage = travel.stages[i]
        // Country Change (or special change)
        if (
          stage.startLocation &&
          stage.endLocation &&
          (stage.startLocation.country._id !== stage.endLocation.country._id || stage.startLocation.special !== stage.endLocation.special)
        ) {
          // More than 1 night
          if (getDiffInDays(stage.departure, stage.arrival) > 1) {
            if (['ownCar', 'otherTransport'].indexOf(stage.transport.type) !== -1) {
              if (stage.midnightCountries) borderCrossings.push(...(stage.midnightCountries as { date: Date; country: CountrySimple }[]))
            } else if (stage.transport.type === 'airplane') {
              borderCrossings.push({
                date: new Date(new Date(stage.departure).valueOf() + 24 * 60 * 60 * 1000),
                country: { _id: this.travelSettings.secoundNightOnAirplaneLumpSumCountry }
              })
            } else if (stage.transport.type === 'shipOrFerry') {
              borderCrossings.push({
                date: new Date(new Date(stage.departure).valueOf() + 24 * 60 * 60 * 1000),
                country: { _id: this.travelSettings.secoundNightOnShipOrFerryLumpSumCountry }
              })
            }
          }
          borderCrossings.push({ date: new Date(stage.arrival), country: stage.endLocation.country, special: stage.endLocation.special })
        }
      }
    }
    return borderCrossings
  }

  getDateOfLastPlaceOfWork(travel: Travel) {
    var date: Date | null = null
    function sameCountryAndSpecial(placeA: Place, placeB: Place): boolean {
      return placeA.country._id === placeB.country._id && placeA.special === placeB.special
    }
    for (var i = travel.stages.length - 1; i >= 0; i--) {
      if (sameCountryAndSpecial(travel.stages[i].endLocation, travel.lastPlaceOfWork)) {
        date = datetimeToDate(travel.stages[i].arrival)
        break
      } else if (sameCountryAndSpecial(travel.stages[i].startLocation, travel.lastPlaceOfWork)) {
        date = datetimeToDate(travel.stages[i].departure)
        break
      }
    }
    return date
  }

  async calculateDays(travel: Travel) {
    const borderCrossings: { date: Date; country: Country; special?: string }[] = []

    for (const borderX of this.getBorderCrossings(travel)) {
      borderCrossings.push({ date: borderX.date, country: await this.getCountryById(borderX.country._id), special: borderX.special })
    }
    const days = this.getDays(travel)
    var bXIndex = 0
    for (const day of days) {
      while (
        bXIndex < borderCrossings.length - 1 &&
        day.date.valueOf() + 1000 * 24 * 60 * 60 - 1 - borderCrossings[bXIndex + 1].date.valueOf() > 0
      ) {
        bXIndex++
      }
      ;(day as Partial<TravelDayFullCountry>).country = borderCrossings[bXIndex].country
      ;(day as Partial<TravelDayFullCountry>).special = borderCrossings[bXIndex].special
    }

    // change days according to last place of work
    const dateOfLastPlaceOfWork = this.getDateOfLastPlaceOfWork(travel)

    if (dateOfLastPlaceOfWork) {
      for (const day of days) {
        if (day.date.valueOf() >= dateOfLastPlaceOfWork.valueOf()) {
          ;(day as Partial<TravelDayFullCountry>).country = await this.getCountryById(travel.lastPlaceOfWork.country._id)
          ;(day as Partial<TravelDayFullCountry>).special = travel.lastPlaceOfWork.special
        }
      }
    }

    travel.days = days as TravelDayFullCountry[]
  }

  async addCateringRefunds(travel: Travel) {
    for (var i = 0; i < travel.days.length; i++) {
      const day = travel.days[i] as TravelDayFullCountry
      if (day.purpose == 'professional') {
        const result: Partial<Refund> = { type: 'catering24' }
        if (i == 0 || i == travel.days.length - 1) {
          result.type = 'catering8'
        }
        var amount = (await this.lumpSumCalculator.getLumpSum(day.country, day.date as Date, day.special))[result.type!]
        var leftover = 1
        if (day.cateringNoRefund.breakfast) leftover -= this.travelSettings.lumpSumCut.breakfast
        if (day.cateringNoRefund.lunch) leftover -= this.travelSettings.lumpSumCut.lunch
        if (day.cateringNoRefund.dinner) leftover -= this.travelSettings.lumpSumCut.dinner

        result.refund = {
          amount:
            Math.round(
              amount *
                leftover *
                ((this.travelSettings.factorCateringLumpSumExceptions as string[]).indexOf(day.country._id) == -1
                  ? this.travelSettings.factorCateringLumpSum
                  : 1) *
                100
            ) / 100
        }
        if (this.travelSettings.allowSpouseRefund && travel.claimSpouseRefund) {
          result.refund.amount! *= 2
        }
        day.refunds.push(result as Refund)
      }
    }
  }

  async addOvernightRefunds(travel: Travel) {
    if (travel.claimOvernightLumpSum) {
      var stageIndex = 0
      for (var i = 0; i < travel.days.length; i++) {
        const day = travel.days[i] as TravelDayFullCountry
        if (day.purpose == 'professional') {
          if (i == travel.days.length - 1) {
            break
          }
          var midnight = (day.date as Date).valueOf() + 1000 * 24 * 60 * 60 - 1
          while (stageIndex < travel.stages.length - 1 && midnight - new Date(travel.stages[stageIndex].arrival).valueOf() > 0) {
            stageIndex++
          }
          if (
            midnight - new Date(travel.stages[stageIndex].departure).valueOf() > 0 &&
            new Date(travel.stages[stageIndex].arrival).valueOf() - midnight > 0
          ) {
            continue
          }
          const result: Partial<Refund> = { type: 'overnight' }
          var amount = (await this.lumpSumCalculator.getLumpSum(day.country, day.date as Date, day.special))[result.type!]
          result.refund = {
            amount:
              Math.round(
                amount *
                  (this.travelSettings.factorOvernightLumpSumExceptions.indexOf(day.country._id) == -1
                    ? this.travelSettings.factorOvernightLumpSum
                    : 1) *
                  100
              ) / 100
          }
          if (this.travelSettings.allowSpouseRefund && travel.claimSpouseRefund) {
            result.refund.amount! *= 2
          }
          day.refunds.push(result as Refund)
        }
      }
    }
  }

  calculateProfessionalShare(travel: Travel) {
    if (travel.days.length > 0) {
      var professionalDays = 0
      var calc = false
      for (const day of travel.days) {
        if (day.purpose === 'professional') {
          professionalDays += 1
        } else {
          calc = true
        }
      }
      if (calc) {
        travel.professionalShare = professionalDays / travel.days.length
      } else {
        travel.professionalShare = 1
      }
    } else {
      travel.professionalShare = null
    }
  }

  calculateRefundforOwnCar(travel: Travel) {
    for (const stage of travel.stages) {
      if (stage.transport.type === 'ownCar') {
        if (stage.transport.distance && stage.transport.distanceRefundType) {
          stage.cost = Object.assign(stage.cost, {
            amount:
              Math.round(stage.transport.distance * this.travelSettings.distanceRefunds[stage.transport.distanceRefundType] * 100) / 100,
            currency: baseCurrency
          })
        }
      }
    }
  }
}

type Invalid = { path: string; err: string | Error; val?: any }
type Warning = { name: string; val?: any; limit?: any }
export class TravelValidator {
  travelSettings!: SettingsTravel

  constructor(travelSettings: SettingsTravel) {
    this.updateSettings(travelSettings)
  }

  updateSettings(travelSettings: SettingsTravel) {
    this.travelSettings = travelSettings
  }

  validate(travel: Travel): Invalid[] {
    return this.validateDates(travel).concat(this.validateCountries(travel))
  }

  /**
   * checks a travel for warnings
   */
  check(travel: Travel): Warning[] {
    return this.checkProfessionalShare(travel).concat(this.checkTravelLength(travel))
  }

  validateDates(travel: Travel): Invalid[] {
    const conflicts = new Set<Invalid>()
    for (var i = 0; i < travel.stages.length; i++) {
      for (var j = 0; j < travel.stages.length; j++) {
        if (i !== j) {
          if (travel.stages[i].departure.valueOf() < travel.stages[j].departure.valueOf()) {
            if (travel.stages[i].arrival.valueOf() <= travel.stages[j].departure.valueOf()) {
              continue
            } else {
              if (travel.stages[i].arrival.valueOf() <= travel.stages[j].arrival.valueOf()) {
                // end of [i] inside of [j]
                conflicts.add({ path: 'stages.' + i + '.arrival', err: 'stagesOverlapping' })
                conflicts.add({ path: 'stages.' + j + '.departure', err: 'stagesOverlapping' })
              } else {
                // [j] inside of [i]
                conflicts.add({ path: 'stages.' + j + '.arrival', err: 'stagesOverlapping' })
                conflicts.add({ path: 'stages.' + j + '.departure', err: 'stagesOverlapping' })
              }
            }
          } else if (travel.stages[i].departure.valueOf() < travel.stages[j].arrival.valueOf()) {
            if (travel.stages[i].arrival.valueOf() <= travel.stages[j].arrival.valueOf()) {
              // [i] inside of [j]
              conflicts.add({ path: 'stages.' + i + '.arrival', err: 'stagesOverlapping' })
              conflicts.add({ path: 'stages.' + i + '.departure', err: 'stagesOverlapping' })
            } else {
              // end of [j] inside of [i]
              conflicts.add({ path: 'stages.' + j + '.arrival', err: 'stagesOverlapping' })
              conflicts.add({ path: 'stages.' + i + '.departure', err: 'stagesOverlapping' })
            }
          } else {
            continue
          }
        }
      }
    }
    return Array.from(conflicts)
  }

  validateCountries(travel: Travel): Invalid[] {
    const conflicts: Invalid[] = []
    for (var i = 1; i < travel.stages.length; i++) {
      if (travel.stages[i - 1].endLocation.country._id !== travel.stages[i].startLocation.country._id) {
        conflicts.push({ path: 'stages.' + (i - 1) + '.endLocation.country', err: 'countryChangeBetweenStages' })
        conflicts.push({ path: 'stages.' + i + '.startLocation.country', err: 'countryChangeBetweenStages' })
      }
    }
    return conflicts
  }

  checkTravelLength(travel: Travel): Warning[] {
    const warnings: Warning[] = []
    const cs = travel.stages.length
    if (cs > 0) {
      const travelLength = new Date(travel.stages[cs - 1].arrival).valueOf() - new Date(travel.stages[0].departure).valueOf()
      const limit = this.travelSettings.minHoursOfTravel * 1000 * 60 * 60
      if (travelLength < limit) {
        warnings.push({ name: 'travelLengthToShort', val: travelLength, limit: limit })
      }
    }
    return warnings
  }

  checkProfessionalShare(travel: Travel): Warning[] {
    const warnings: Warning[] = []
    if (travel.professionalShare !== null && travel.professionalShare < this.travelSettings.minProfessionalShare) {
      warnings.push({ name: 'professionalShareToSmall', val: travel.professionalShare, limit: this.travelSettings.minProfessionalShare })
    }
    return warnings
  }
}

export default class LumpSumCalculator {
  fallBackLumpSumCountry!: CountryCode
  getCountryById: (id: CountryCode) => Promise<Country>

  constructor(getCountryById: (id: CountryCode) => Promise<Country>, fallBackLumpSumCountry: CountryCode) {
    this.getCountryById = getCountryById
    this.setFallBackLumpSumCountry(fallBackLumpSumCountry)
  }

  setFallBackLumpSumCountry(fallBackLumpSumCountry: CountryCode) {
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
