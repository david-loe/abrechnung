import {
  _id,
  baseCurrency,
  binary,
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
  TravelSettings
} from '../types.js'
import { datetimeToDate, getDayList, getDiffInDays } from '../utils/scripts.js'

export class TravelCalculator {
  getCountryById: (id: CountryCode) => Promise<Country>
  lumpSumCalculator!: LumpSumCalculator
  validator: TravelValidator
  travelSettings!: TravelSettings<_id>
  stagesCompareFn = (a: Stage<_id, binary>, b: Stage<_id, binary>) => new Date(a.departure).valueOf() - new Date(b.departure).valueOf()
  expensesCompareFn = (a: TravelExpense<_id, binary>, b: TravelExpense<_id, binary>) =>
    new Date(a.cost.date).valueOf() - new Date(b.cost.date).valueOf()

  constructor(getCountryById: (id: CountryCode) => Promise<Country>, travelSettings: TravelSettings<_id>) {
    this.getCountryById = getCountryById
    this.lumpSumCalculator = new LumpSumCalculator(this.getCountryById, travelSettings.fallbackLumpSumCountry)
    this.validator = new TravelValidator(travelSettings)
    this.updateSettings(travelSettings)
  }

  async calc(travel: Travel<_id, binary>): Promise<Invalid[]> {
    this.sort(travel)
    const conflicts = this.validator.validate(travel)
    if (conflicts.length === 0) {
      travel.progress = this.getProgress(travel)
      travel.days = await this.calculateDays(travel.stages, travel.lastPlaceOfWork, travel.destinationPlace, travel.days)
      travel.professionalShare = this.getProfessionalShare(travel.days)
      this.addRefundsForOwnCar(travel.stages)
      await this.addCateringRefunds(travel.days, travel.stages, Boolean(travel.claimSpouseRefund))
      await this.addOvernightRefunds(travel.days, travel.stages, Boolean(travel.claimSpouseRefund))
    }
    return conflicts
  }

  updateSettings(travelSettings: TravelSettings<_id>) {
    this.travelSettings = travelSettings
    this.validator.updateSettings(travelSettings)
    this.lumpSumCalculator.setFallBackLumpSumCountry(travelSettings.fallbackLumpSumCountry)
  }

  sort(travel: Travel<_id, binary>) {
    travel.stages.sort(this.stagesCompareFn)
    travel.expenses.sort(this.expensesCompareFn)
  }

  getProgress(travel: Travel<_id, binary>) {
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

  getDefaultLastPlaceOfWork(
    stages: Stage<_id, binary>[],
    destinationPlace: Travel<_id, binary>['destinationPlace']
  ): Travel<_id, binary>['lastPlaceOfWork'] {
    if (this.travelSettings.defaultLastPlaceOfWork === 'destinationPlace') {
      return { country: destinationPlace.country }
    } else if (this.travelSettings.defaultLastPlaceOfWork === 'lastEndLocation' && stages.length > 0) {
      const lpow: Travel<_id, binary>['lastPlaceOfWork'] = { country: stages[stages.length - 1].endLocation.country }
      if (stages[stages.length - 1].endLocation.special) {
        lpow.special = stages[stages.length - 1].endLocation.special
      }
      return lpow
    }
    return null
  }

  getDays(stages: Stage<_id, binary>[], oldDays: TravelDay<_id>[]) {
    if (stages.length > 0) {
      const days = getDayList(stages[0].departure, stages[stages.length - 1].arrival)
      const newDays: {
        date: Date
        lumpSums: TravelDay<_id>['lumpSums']
        cateringRefund?: TravelDay<_id>['cateringRefund']
        purpose?: TravelDay<_id>['purpose']
        overnightRefund?: TravelDay<_id>['overnightRefund']
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

  getBorderCrossings(stages: Stage<_id, binary>[]) {
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

  getDateOfLastPlaceOfWork(
    stages: Stage<_id, binary>[],
    lastPlaceOfWork: Travel<_id, binary>['lastPlaceOfWork'],
    destinationPlace: Travel<_id, binary>['destinationPlace']
  ) {
    let date: Date | null = null
    let sameCountryDate: Date | null = null
    const lpow = lastPlaceOfWork ?? this.getDefaultLastPlaceOfWork(stages, destinationPlace)
    if (lpow) {
      for (let i = stages.length - 1; i >= 0; i--) {
        if (stages[i].endLocation.country._id === lpow.country._id) {
          if (!sameCountryDate) {
            sameCountryDate = datetimeToDate(stages[i].arrival)
          }
          if (stages[i].endLocation.special === lpow.special) {
            date = datetimeToDate(stages[i].arrival)
            break
          }
        }
        if (stages[i].startLocation.country._id === lpow.country._id) {
          if (!sameCountryDate) {
            sameCountryDate = datetimeToDate(stages[i].departure)
          }
          if (stages[i].startLocation.special === lpow.special) {
            date = datetimeToDate(stages[i].departure)
            break
          }
        }
      }
    }
    date = date ?? sameCountryDate
    if (date) {
      return { date, lastPlaceOfWork: lpow as Omit<Place, 'place'> }
    }
    return null
  }

  async calculateDays(
    stages: Stage<_id, binary>[],
    lastPlaceOfWork: Travel<_id, binary>['lastPlaceOfWork'],
    destinationPlace: Travel<_id, binary>['destinationPlace'],
    oldDays: TravelDay<_id>[]
  ) {
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
      ;(day as Partial<TravelDayFullCountry<_id>>).country = borderCrossings[bXIndex].country
      ;(day as Partial<TravelDayFullCountry<_id>>).special = borderCrossings[bXIndex].special
    }

    // change days according to last place of work
    const dateOfLastPlaceOfWork = this.getDateOfLastPlaceOfWork(stages, lastPlaceOfWork, destinationPlace)

    if (dateOfLastPlaceOfWork) {
      for (const day of days) {
        if (day.date.valueOf() >= dateOfLastPlaceOfWork.date.valueOf()) {
          ;(day as Partial<TravelDayFullCountry<_id>>).country = await this.getCountryById(
            dateOfLastPlaceOfWork.lastPlaceOfWork.country._id
          )
          ;(day as Partial<TravelDayFullCountry<_id>>).special = dateOfLastPlaceOfWork.lastPlaceOfWork.special
        }
      }
    }

    return days as TravelDayFullCountry<_id>[]
  }

  async getCateringRefund(day: TravelDayFullCountry<_id>, type: CateringType, claimSpouseRefund: boolean) {
    const result: TravelDay<_id>['lumpSums']['catering'] = { type, refund: { amount: 0 } }
    const lumpSum = await this.lumpSumCalculator.getLumpSum(day.country, new Date(day.date), day.special)
    const amount = lumpSum[result.type]
    let cut = 0
    if (!day.cateringRefund.breakfast) cut += this.travelSettings.lumpSumCut.breakfast
    if (!day.cateringRefund.lunch) cut += this.travelSettings.lumpSumCut.lunch
    if (!day.cateringRefund.dinner) cut += this.travelSettings.lumpSumCut.dinner

    const afterCut = Math.max(0, amount - Math.round(lumpSum.catering24 * cut * 100) / 100)
    result.refund.amount =
      Math.round(
        afterCut *
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

  getTotalTravelLengthMS(stages: Stage<_id, binary>[]) {
    let totalTravelLength = 0
    if (stages.length > 0) {
      totalTravelLength = new Date(stages[stages.length - 1].arrival).valueOf() - new Date(stages[0].departure).valueOf()
    }
    return totalTravelLength
  }

  async addCateringRefunds(days: TravelDay<_id>[], stages: Stage<_id, binary>[], claimSpouseRefund: boolean) {
    const totalTravelLength = this.getTotalTravelLengthMS(stages)
    const h = 60 * 60 * 1000
    // Mehrtägige Reise
    if (totalTravelLength > 24 * h) {
      for (let i = 0; i < days.length; i++) {
        const day = days[i] as TravelDayFullCountry<_id>
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
            days[0].lumpSums.catering = await this.getCateringRefund(days[0] as TravelDayFullCountry<_id>, 'catering8', claimSpouseRefund)
          }
          if (days[1].purpose === 'professional') {
            days[1].lumpSums.catering = await this.getCateringRefund(days[1] as TravelDayFullCountry<_id>, 'catering8', claimSpouseRefund)
          }
        } else if (day1Length > 8 * h) {
          if (days[0].purpose === 'professional') {
            days[0].lumpSums.catering = await this.getCateringRefund(days[0] as TravelDayFullCountry<_id>, 'catering8', claimSpouseRefund)
          }
        } else if (day2Length > 8 * h) {
          if (days[1].purpose === 'professional') {
            days[1].lumpSums.catering = await this.getCateringRefund(days[1] as TravelDayFullCountry<_id>, 'catering8', claimSpouseRefund)
          }
        } else {
          if (day1Length >= day2Length) {
            if (days[0].purpose === 'professional') {
              days[0].lumpSums.catering = await this.getCateringRefund(days[0] as TravelDayFullCountry<_id>, 'catering8', claimSpouseRefund)
            }
          } else {
            if (days[1].purpose === 'professional') {
              days[1].lumpSums.catering = await this.getCateringRefund(days[1] as TravelDayFullCountry<_id>, 'catering8', claimSpouseRefund)
            }
          }
        }
      } else if (days.length === 1) {
        if (days[0].purpose === 'professional') {
          days[0].lumpSums.catering = await this.getCateringRefund(days[0] as TravelDayFullCountry<_id>, 'catering8', claimSpouseRefund)
        }
      }
    }
  }

  async addOvernightRefunds(days: TravelDay<_id>[], stages: Stage<_id, binary>[], claimSpouseRefund: boolean) {
    let stageIndex = 0
    for (let i = 0; i < days.length; i++) {
      const day = days[i] as TravelDayFullCountry<_id>
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
        const refund = { amount: 0 }
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

  getProfessionalShare(days: TravelDay<_id>[]) {
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

  addRefundsForOwnCar(stages: Stage<_id, binary>[]) {
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

type Invalid = { path: string; err: string | Error; val?: unknown }
type Warning = { name: string; val?: unknown; limit?: unknown }
export class TravelValidator {
  travelSettings!: TravelSettings<_id>

  constructor(travelSettings: TravelSettings<_id>) {
    this.updateSettings(travelSettings)
  }

  updateSettings(travelSettings: TravelSettings<_id>) {
    this.travelSettings = travelSettings
  }

  validate(travel: Travel<_id, binary>): Invalid[] {
    return this.validateDates(travel).concat(this.validateCountries(travel))
  }

  /**
   * checks a travel for warnings
   */
  check(travel: Travel<_id, binary>): Warning[] {
    return this.checkProfessionalShare(travel).concat(this.checkTravelLength(travel))
  }

  validateDates(travel: Travel<_id, binary>): Invalid[] {
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

  validateCountries(travel: Travel<_id, binary>): Invalid[] {
    const conflicts: Invalid[] = []
    for (let i = 1; i < travel.stages.length; i++) {
      if (travel.stages[i - 1].endLocation.country._id !== travel.stages[i].startLocation.country._id) {
        conflicts.push({ path: `stages.${i - 1}.endLocation.country`, err: 'countryChangeBetweenStages' })
        conflicts.push({ path: `stages.${i}.startLocation.country`, err: 'countryChangeBetweenStages' })
      }
    }
    return conflicts
  }

  checkTravelLength(travel: Travel<_id, binary>): Warning[] {
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

  checkProfessionalShare(travel: Travel<_id, binary>): Warning[] {
    const warnings: Warning[] = []
    if (travel.professionalShare !== null && travel.professionalShare < this.travelSettings.minProfessionalShare) {
      warnings.push({ name: 'professionalShareToSmall', val: travel.professionalShare, limit: this.travelSettings.minProfessionalShare })
    }
    return warnings
  }
}

export default class LumpSumCalculator {
  fallbackLumpSumCountry!: CountryCode
  getCountryById: (id: CountryCode) => Promise<Country>

  constructor(getCountryById: (id: CountryCode) => Promise<Country>, fallbackLumpSumCountry: CountryCode) {
    this.getCountryById = getCountryById
    this.setFallBackLumpSumCountry(fallbackLumpSumCountry)
  }

  setFallBackLumpSumCountry(fallbackLumpSumCountry: CountryCode) {
    this.fallbackLumpSumCountry = fallbackLumpSumCountry
  }

  async getLumpSum(country: Country, date: Date, special: string | undefined = undefined): Promise<LumpSum> {
    if (country.lumpSumsFrom) {
      const lumpSumFrom = await this.getCountryById(country.lumpSumsFrom)
      return this.getLumpSum(lumpSumFrom, date)
    }
    if (country.lumpSums.length === 0) {
      const fallbackLumpSumCountry = await this.getCountryById(this.fallbackLumpSumCountry)
      return this.getLumpSum(fallbackLumpSumCountry, date)
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
