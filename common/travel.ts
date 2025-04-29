import { datetimeToDate, getDayList, getDiffInDays } from './scripts.js'
import {
  BaseCurrencyMoney,
  CateringType,
  Country,
  CountryCode,
  CountrySimple,
  LumpSum,
  LumpsumType,
  Place,
  Stage,
  Travel,
  TravelDay,
  TravelDayFullCountry,
  TravelExpense,
  TravelSettings,
  baseCurrency
} from './types.js'

export class TravelCalculator {
  getCountryById: (id: CountryCode) => Promise<Country>
  lumpSumCalculator!: LumpSumCalculator
  validator: TravelValidator
  travelSettings!: TravelSettings
  stagesCompareFn = (a: Stage, b: Stage) => new Date(a.departure).valueOf() - new Date(b.departure).valueOf()
  expensesCompareFn = (a: TravelExpense, b: TravelExpense) => new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()

  constructor(getCountryById: (id: CountryCode) => Promise<Country>, travelSettings: TravelSettings) {
    this.getCountryById = getCountryById
    this.lumpSumCalculator = new LumpSumCalculator(this.getCountryById, travelSettings.fallBackLumpSumCountry)
    this.validator = new TravelValidator(travelSettings)
    this.updateSettings(travelSettings)
  }

  async calc(travel: Travel): Promise<Invalid[]> {
    this.sort(travel)
    const conflicts = this.validator.validate(travel)
    if (conflicts.length === 0) {
      travel.progress = this.getProgress(travel)
      travel.days = await this.calculateDays(travel.stages, travel.lastPlaceOfWork, travel.days)
      travel.professionalShare = this.getProfessionalShare(travel.days)
      this.addRefundsForOwnCar(travel.stages)
      await this.addCateringRefunds(travel.days, travel.stages, Boolean(travel.claimSpouseRefund))
      await this.addOvernightRefunds(travel.days, travel.stages, Boolean(travel.claimSpouseRefund))
    }
    return conflicts
  }

  updateSettings(travelSettings: TravelSettings) {
    this.travelSettings = travelSettings
    this.validator.updateSettings(travelSettings)
    this.lumpSumCalculator.setFallBackLumpSumCountry(travelSettings.fallBackLumpSumCountry)
  }

  sort(travel: Travel) {
    travel.stages.sort(this.stagesCompareFn)
    travel.expenses.sort(this.expensesCompareFn)
  }

  getProgress(travel: Travel) {
    if (travel.stages.length > 0) {
      const approvedLength = getDiffInDays(travel.startDate, travel.endDate) + 1
      const stageLength = getDiffInDays(travel.stages[0].departure, travel.stages[travel.stages.length - 1].arrival) + 1
      if (stageLength >= approvedLength) {
        return 100
      }
      return Math.round((stageLength / approvedLength) * 100)
    }
    return 0
  }

  getDays(stages: Stage[], oldDays: TravelDay[]) {
    if (stages.length > 0) {
      const days = getDayList(stages[0].departure, stages[stages.length - 1].arrival)
      const newDays: {
        date: Date
        lumpSums: TravelDay['lumpSums']
        cateringRefund?: TravelDay['cateringRefund']
        purpose?: TravelDay['purpose']
        overnightRefund?: TravelDay['overnightRefund']
      }[] = days.map((d) => {
        return { date: d, lumpSums: { overnight: { refund: { amount: 0 } }, catering: { refund: { amount: 0 }, type: 'catering8' } } }
      })
      for (const oldDay of oldDays) {
        for (const newDay of newDays) {
          if (new Date(oldDay.date).valueOf() - new Date(newDay.date).valueOf() === 0) {
            newDay.cateringRefund = oldDay.cateringRefund
            newDay.purpose = oldDay.purpose
            newDay.overnightRefund = oldDay.overnightRefund
            break
          }
        }
      }
      return newDays
    }
    return []
  }

  getBorderCrossings(stages: Stage[]) {
    const borderCrossings: { date: Date; country: { _id: CountryCode }; special?: string }[] = []
    if (stages.length > 0) {
      const startCountry = stages[0].startLocation.country
      borderCrossings.push({ date: new Date(stages[0].departure), country: startCountry })

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i]
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
                country: { _id: this.travelSettings.secondNightOnAirplaneLumpSumCountry }
              })
            } else if (stage.transport.type === 'shipOrFerry') {
              borderCrossings.push({
                date: new Date(new Date(stage.departure).valueOf() + 24 * 60 * 60 * 1000),
                country: { _id: this.travelSettings.secondNightOnShipOrFerryLumpSumCountry }
              })
            }
          }
          borderCrossings.push({ date: new Date(stage.arrival), country: stage.endLocation.country, special: stage.endLocation.special })
        }
      }
    }
    return borderCrossings
  }

  getDateOfLastPlaceOfWork(stages: Stage[], lastPlaceOfWork: Place) {
    let date: Date | null = null
    let sameCountryDate: Date | null = null
    for (let i = stages.length - 1; i >= 0; i--) {
      if (stages[i].endLocation.country._id === lastPlaceOfWork.country._id) {
        if (!sameCountryDate) {
          sameCountryDate = datetimeToDate(stages[i].arrival)
        }
        if (stages[i].endLocation.special === lastPlaceOfWork.special) {
          date = datetimeToDate(stages[i].arrival)
          break
        }
      }
      if (stages[i].startLocation.country._id === lastPlaceOfWork.country._id) {
        if (!sameCountryDate) {
          sameCountryDate = datetimeToDate(stages[i].departure)
        }
        if (stages[i].startLocation.special === lastPlaceOfWork.special) {
          date = datetimeToDate(stages[i].departure)
          break
        }
      }
    }
    return date ?? sameCountryDate
  }

  async calculateDays(stages: Stage[], lastPlaceOfWork: Place, oldDays: TravelDay[]) {
    const borderCrossings: { date: Date; country: Country; special?: string }[] = []

    for (const borderX of this.getBorderCrossings(stages)) {
      borderCrossings.push({ date: borderX.date, country: await this.getCountryById(borderX.country._id), special: borderX.special })
    }
    const days = this.getDays(stages, oldDays)
    let bXIndex = 0
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
    const dateOfLastPlaceOfWork = this.getDateOfLastPlaceOfWork(stages, lastPlaceOfWork)

    if (dateOfLastPlaceOfWork) {
      for (const day of days) {
        if (day.date.valueOf() >= dateOfLastPlaceOfWork.valueOf()) {
          ;(day as Partial<TravelDayFullCountry>).country = await this.getCountryById(lastPlaceOfWork.country._id)
          ;(day as Partial<TravelDayFullCountry>).special = lastPlaceOfWork.special
        }
      }
    }

    return days as TravelDayFullCountry[]
  }

  async getCateringRefund(day: TravelDayFullCountry, type: CateringType, claimSpouseRefund: boolean) {
    const result: TravelDay['lumpSums']['catering'] = { type, refund: { amount: null } }
    const amount = (await this.lumpSumCalculator.getLumpSum(day.country, new Date(day.date), day.special))[result.type]
    let leftover = 1
    if (!day.cateringRefund.breakfast) leftover -= this.travelSettings.lumpSumCut.breakfast
    if (!day.cateringRefund.lunch) leftover -= this.travelSettings.lumpSumCut.lunch
    if (!day.cateringRefund.dinner) leftover -= this.travelSettings.lumpSumCut.dinner

    result.refund.amount =
      Math.round(
        amount *
          leftover *
          ((this.travelSettings.factorCateringLumpSumExceptions as string[]).indexOf(day.country._id) === -1
            ? this.travelSettings.factorCateringLumpSum
            : 1) *
          100
      ) / 100

    if (this.travelSettings.allowSpouseRefund && claimSpouseRefund) {
      result.refund.amount *= 2
    }
    return result
  }

  getTotalTravelLengthMS(stages: Stage[]) {
    let totalTravelLength = 0
    if (stages.length > 0) {
      totalTravelLength = new Date(stages[stages.length - 1].arrival).valueOf() - new Date(stages[0].departure).valueOf()
    }
    return totalTravelLength
  }

  async addCateringRefunds(days: TravelDay[], stages: Stage[], claimSpouseRefund: boolean) {
    const totalTravelLength = this.getTotalTravelLengthMS(stages)
    const h = 60 * 60 * 1000
    // Mehrtägige Reise
    if (totalTravelLength > 24 * h) {
      for (let i = 0; i < days.length; i++) {
        const day = days[i] as TravelDayFullCountry
        if (day.purpose === 'professional') {
          let refundType: LumpsumType | null = 'catering24'
          if (i === 0 || i === days.length - 1) {
            refundType = 'catering8'
          }
          if (refundType) {
            day.lumpSums.catering = await this.getCateringRefund(day, refundType, claimSpouseRefund)
          }
        }
      }
    } else if (totalTravelLength > 8 * h) {
      // "Eintägige" Reise
      if (days.length === 2) {
        const day1Length = new Date(days[1].date).valueOf() - new Date(stages[0].departure).valueOf()
        const day2Length = new Date(stages[stages.length - 1].arrival).valueOf() - new Date(days[1].date).valueOf()
        if (day1Length > 8 * h && day2Length > 8 * h) {
          if (days[0].purpose === 'professional') {
            days[0].lumpSums.catering = await this.getCateringRefund(days[0] as TravelDayFullCountry, 'catering8', claimSpouseRefund)
          }
          if (days[1].purpose === 'professional') {
            days[1].lumpSums.catering = await this.getCateringRefund(days[1] as TravelDayFullCountry, 'catering8', claimSpouseRefund)
          }
        } else if (day1Length > 8 * h) {
          if (days[0].purpose === 'professional') {
            days[0].lumpSums.catering = await this.getCateringRefund(days[0] as TravelDayFullCountry, 'catering8', claimSpouseRefund)
          }
        } else if (day2Length > 8 * h) {
          if (days[1].purpose === 'professional') {
            days[1].lumpSums.catering = await this.getCateringRefund(days[1] as TravelDayFullCountry, 'catering8', claimSpouseRefund)
          }
        } else {
          if (day1Length >= day2Length) {
            if (days[0].purpose === 'professional') {
              days[0].lumpSums.catering = await this.getCateringRefund(days[0] as TravelDayFullCountry, 'catering8', claimSpouseRefund)
            }
          } else {
            if (days[1].purpose === 'professional') {
              days[1].lumpSums.catering = await this.getCateringRefund(days[1] as TravelDayFullCountry, 'catering8', claimSpouseRefund)
            }
          }
        }
      } else if (days.length === 1) {
        if (days[0].purpose === 'professional') {
          days[0].lumpSums.catering = await this.getCateringRefund(days[0] as TravelDayFullCountry, 'catering8', claimSpouseRefund)
        }
      }
    }
  }

  async addOvernightRefunds(days: TravelDay[], stages: Stage[], claimSpouseRefund: boolean) {
    let stageIndex = 0
    for (let i = 0; i < days.length; i++) {
      const day = days[i] as TravelDayFullCountry
      if (day.overnightRefund && day.purpose === 'professional') {
        if (i === days.length - 1) {
          break
        }
        const midnight = new Date(day.date).valueOf() + 1000 * 24 * 60 * 60 - 1
        while (stageIndex < stages.length - 1 && midnight - new Date(stages[stageIndex].arrival).valueOf() > 0) {
          stageIndex++
        }
        if (
          midnight - new Date(stages[stageIndex].departure).valueOf() > 0 &&
          new Date(stages[stageIndex].arrival).valueOf() - midnight > 0
        ) {
          continue
        }
        const refund: BaseCurrencyMoney = { amount: null }
        const amount = (await this.lumpSumCalculator.getLumpSum(day.country, new Date(day.date), day.special)).overnight
        refund.amount =
          Math.round(
            amount *
              (this.travelSettings.factorOvernightLumpSumExceptions.indexOf(day.country._id) === -1
                ? this.travelSettings.factorOvernightLumpSum
                : 1) *
              100
          ) / 100

        if (this.travelSettings.allowSpouseRefund && claimSpouseRefund) {
          refund.amount *= 2
        }
        day.lumpSums.overnight = { refund }
      }
    }
  }

  getProfessionalShare(days: TravelDay[]) {
    if (days.length > 0) {
      let professionalDays = 0
      let calc = false
      for (const day of days) {
        if (day.purpose === 'professional') {
          professionalDays += 1
        } else {
          calc = true
        }
      }
      if (calc) {
        return professionalDays / days.length
      }
      return 1
    }
    return null
  }

  addRefundsForOwnCar(stages: Stage[]) {
    for (const stage of stages) {
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
  travelSettings!: TravelSettings

  constructor(travelSettings: TravelSettings) {
    this.updateSettings(travelSettings)
  }

  updateSettings(travelSettings: TravelSettings) {
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
    for (let i = 0; i < travel.stages.length; i++) {
      for (let j = 0; j < travel.stages.length; j++) {
        if (i !== j) {
          if (travel.stages[i].departure.valueOf() < travel.stages[j].departure.valueOf()) {
            if (travel.stages[i].arrival.valueOf() <= travel.stages[j].departure.valueOf()) {
            } else {
              if (travel.stages[i].arrival.valueOf() <= travel.stages[j].arrival.valueOf()) {
                // end of [i] inside of [j]
                conflicts.add({ path: `stages.${i}.arrival`, err: 'stagesOverlapping' })
                conflicts.add({ path: `stages.${j}.departure`, err: 'stagesOverlapping' })
              } else {
                // [j] inside of [i]
                conflicts.add({ path: `stages.${j}.arrival`, err: 'stagesOverlapping' })
                conflicts.add({ path: `stages.${j}.departure`, err: 'stagesOverlapping' })
              }
            }
          } else if (travel.stages[i].departure.valueOf() < travel.stages[j].arrival.valueOf()) {
            if (travel.stages[i].arrival.valueOf() <= travel.stages[j].arrival.valueOf()) {
              // [i] inside of [j]
              conflicts.add({ path: `stages.${i}.arrival`, err: 'stagesOverlapping' })
              conflicts.add({ path: `stages.${i}.departure`, err: 'stagesOverlapping' })
            } else {
              // end of [j] inside of [i]
              conflicts.add({ path: `stages.${j}.arrival`, err: 'stagesOverlapping' })
              conflicts.add({ path: `stages.${i}.departure`, err: 'stagesOverlapping' })
            }
          } else {
          }
        }
      }
    }
    return Array.from(conflicts)
  }

  validateCountries(travel: Travel): Invalid[] {
    const conflicts: Invalid[] = []
    for (let i = 1; i < travel.stages.length; i++) {
      if (travel.stages[i - 1].endLocation.country._id !== travel.stages[i].startLocation.country._id) {
        conflicts.push({ path: `stages.${i - 1}.endLocation.country`, err: 'countryChangeBetweenStages' })
        conflicts.push({ path: `stages.${i}.startLocation.country`, err: 'countryChangeBetweenStages' })
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
    }
    if (country.lumpSums.length === 0) {
      const fallBackLumpSumCountry = await this.getCountryById(this.fallBackLumpSumCountry)
      return this.getLumpSum(fallBackLumpSumCountry, date)
    }
    let nearest = 0
    for (let i = 0; i < country.lumpSums.length; i++) {
      const diff = date.valueOf() - new Date(country.lumpSums[i].validFrom).valueOf()
      if (diff >= 0 && diff < date.valueOf() - new Date(country.lumpSums[nearest].validFrom).valueOf()) {
        nearest = i
      }
    }
    const neatestLumpSums = country.lumpSums[nearest]
    if (date.valueOf() - new Date(neatestLumpSums.validFrom).valueOf() < 0) {
      throw new Error(`No valid lumpSum found for Country: ${country._id} for date: ${date}`)
    }
    if (special && neatestLumpSums.specials) {
      for (const lumpSumSpecial of neatestLumpSums.specials) {
        if (lumpSumSpecial.city === special) {
          return lumpSumSpecial
        }
      }
    }
    return neatestLumpSums
  }
}
