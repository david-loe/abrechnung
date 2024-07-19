import { datetimeToDate, getDayList, getDiffInDays } from './scripts.js'
import { CountryCode, CountrySimple, Travel as ITravel, Meal, Place, PurposeSimple, Refund, TravelDay } from './types.js'

interface Travel extends ITravel {}
class Travel {
  constructor(travel: ITravel) {
    Object.assign(this, travel)
  }
  calculateProgress() {
    if (this.stages.length > 0) {
      var approvedLength = getDiffInDays(this.startDate, this.endDate) + 1
      var stageLength = getDiffInDays(this.stages[0].departure, this.stages[this.stages.length - 1].arrival) + 1
      if (stageLength >= approvedLength) {
        this.progress = 100
      } else {
        this.progress = Math.round((stageLength / approvedLength) * 100)
      }
    } else {
      this.progress = 0
    }
  }

  getDays() {
    if (this.stages.length > 0) {
      const days = getDayList(this.stages[0].departure, this.stages[this.stages.length - 1].arrival)
      const newDays: { date: Date; cateringNoRefund?: { [key in Meal]: boolean }; purpose?: PurposeSimple; refunds: Refund[] }[] = days.map(
        (d) => {
          return { date: d, refunds: [] }
        }
      )
      for (const oldDay of this.days) {
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

  async getBorderCrossings() {
    const borderCrossings: { date: Date; country: { _id: CountryCode }; special?: string }[] = []
    if (this.stages.length > 0) {
      const startCountry = this.stages[0].startLocation.country
      borderCrossings.push({ date: new Date(this.stages[0].departure), country: startCountry })

      for (var i = 0; i < this.stages.length; i++) {
        const stage = this.stages[i]
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
                country: { _id: settings.secoundNightOnAirplaneLumpSumCountry }
              })
            } else if (stage.transport.type === 'shipOrFerry') {
              borderCrossings.push({
                date: new Date(new Date(stage.departure).valueOf() + 24 * 60 * 60 * 1000),
                country: { _id: settings.secoundNightOnShipOrFerryLumpSumCountry }
              })
            }
          }
          borderCrossings.push({ date: new Date(stage.arrival), country: stage.endLocation.country, special: stage.endLocation.special })
        }
      }
    }
    return borderCrossings
  }

  getDateOfLastPlaceOfWork() {
    var date: Date | null = null
    function sameCountryAndSpecial(placeA: Place, placeB: Place): boolean {
      return placeA.country._id === placeB.country._id && placeA.special === placeB.special
    }
    for (var i = this.stages.length - 1; i >= 0; i--) {
      if (sameCountryAndSpecial(this.stages[i].endLocation, this.lastPlaceOfWork)) {
        date = datetimeToDate(this.stages[i].arrival)
        break
      } else if (sameCountryAndSpecial(this.stages[i].startLocation, this.lastPlaceOfWork)) {
        date = datetimeToDate(this.stages[i].departure)
        break
      }
    }
    return date
  }

  async calculateDays() {
    const borderCrossings = await this.getBorderCrossings()
    const days = this.getDays()
    for (const borderX of borderCrossings) {
      const dbCountry = await Country.findOne({ _id: borderX.country._id })
      if (dbCountry) {
        borderX.country = dbCountry
      } else {
        throw new Error('No Country found with _id: ' + borderX.country._id)
      }
    }
    var bXIndex = 0
    for (const day of days) {
      while (
        bXIndex < borderCrossings.length - 1 &&
        day.date.valueOf() + 1000 * 24 * 60 * 60 - 1 - borderCrossings[bXIndex + 1].date.valueOf() > 0
      ) {
        bXIndex++
      }
      ;(day as Partial<TravelDay>).country = borderCrossings[bXIndex].country
      ;(day as Partial<TravelDay>).special = borderCrossings[bXIndex].special
    }

    // change days according to last place of work
    const dateOfLastPlaceOfWork = this.getDateOfLastPlaceOfWork()

    if (dateOfLastPlaceOfWork) {
      const dbCountry = await Country.findOne({ _id: this.lastPlaceOfWork.country._id })
      if (!dbCountry) {
        throw new Error('No Country found with _id: ' + this.lastPlaceOfWork.country._id)
      }
      for (const day of days) {
        if (day.date.valueOf() >= dateOfLastPlaceOfWork.valueOf()) {
          ;(day as Partial<TravelDay>).country = dbCountry
          ;(day as Partial<TravelDay>).special = this.lastPlaceOfWork.special
        }
      }
    }

    this.days = days as TravelDay[]
  }

  async addCateringRefunds() {
    for (var i = 0; i < this.days.length; i++) {
      const day = this.days[i]
      if (day.purpose == 'professional') {
        const result: Partial<Refund> = { type: 'catering24' }
        if (i == 0 || i == this.days.length - 1) {
          result.type = 'catering8'
        }
        var amount = (await (day.country as CountryDoc).getLumpSum(day.date as Date, day.special))[result.type!]
        var leftover = 1
        if (day.cateringNoRefund.breakfast) leftover -= settings.breakfastCateringLumpSumCut
        if (day.cateringNoRefund.lunch) leftover -= settings.lunchCateringLumpSumCut
        if (day.cateringNoRefund.dinner) leftover -= settings.dinnerCateringLumpSumCut

        result.refund = {
          amount:
            Math.round(
              amount *
                leftover *
                ((settings.factorCateringLumpSumExceptions as string[]).indexOf(day.country._id) == -1
                  ? settings.factorCateringLumpSum
                  : 1) *
                100
            ) / 100
        }
        if (settings.allowSpouseRefund && this.claimSpouseRefund) {
          result.refund.amount! *= 2
        }
        day.refunds.push(result as Refund)
      }
    }
  }

  async addOvernightRefunds() {
    if (this.claimOvernightLumpSum) {
      var stageIndex = 0
      for (var i = 0; i < this.days.length; i++) {
        const day = this.days[i]
        if (day.purpose == 'professional') {
          if (i == this.days.length - 1) {
            break
          }
          var midnight = (day.date as Date).valueOf() + 1000 * 24 * 60 * 60 - 1
          while (stageIndex < this.stages.length - 1 && midnight - new Date(this.stages[stageIndex].arrival).valueOf() > 0) {
            stageIndex++
          }
          if (
            midnight - new Date(this.stages[stageIndex].departure).valueOf() > 0 &&
            new Date(this.stages[stageIndex].arrival).valueOf() - midnight > 0
          ) {
            continue
          }
          const result: Partial<Refund> = { type: 'overnight' }
          var amount = (await (day.country as CountryDoc).getLumpSum(day.date as Date, day.special))[result.type!]
          result.refund = {
            amount:
              Math.round(
                amount *
                  (settings.factorOvernightLumpSumExceptions.indexOf(day.country._id) == -1 ? settings.factorOvernightLumpSum : 1) *
                  100
              ) / 100
          }
          if (settings.allowSpouseRefund && this.claimSpouseRefund) {
            result.refund.amount! *= 2
          }
          day.refunds.push(result as Refund)
        }
      }
    }
  }

  calculateProfessionalShare() {
    if (this.days.length > 0) {
      var professionalDays = 0
      var calc = false
      for (const day of this.days) {
        if (day.purpose === 'professional') {
          professionalDays += 1
        } else {
          calc = true
        }
      }
      if (calc) {
        this.professionalShare = professionalDays / this.days.length
      } else {
        this.professionalShare = 1
      }
    } else {
      this.professionalShare = null
    }
  }

  calculateRefundforOwnCar() {
    for (const stage of this.stages) {
      if (stage.transport.type === 'ownCar') {
        if (stage.transport.distance && stage.transport.distanceRefundType) {
          stage.cost = Object.assign(stage.cost, {
            amount: Math.round(stage.transport.distance * settings.distanceRefunds[stage.transport.distanceRefundType] * 100) / 100,
            currency: baseCurrency
          })
        }
      }
    }
  }

  validateDates() {
    const conflicts = new Set<string>()
    for (var i = 0; i < this.stages.length; i++) {
      for (var j = 0; j < this.stages.length; j++) {
        if (i !== j) {
          if (this.stages[i].departure.valueOf() < this.stages[j].departure.valueOf()) {
            if (this.stages[i].arrival.valueOf() <= this.stages[j].departure.valueOf()) {
              continue
            } else {
              if (this.stages[i].arrival.valueOf() <= this.stages[j].arrival.valueOf()) {
                // end of [i] inside of [j]
                conflicts.add('stages.' + i + '.arrival')
                conflicts.add('stages.' + j + '.departure')
              } else {
                // [j] inside of [i]
                conflicts.add('stages.' + j + '.arrival')
                conflicts.add('stages.' + j + '.departure')
              }
            }
          } else if (this.stages[i].departure.valueOf() < this.stages[j].arrival.valueOf()) {
            if (this.stages[i].arrival.valueOf() <= this.stages[j].arrival.valueOf()) {
              // [i] inside of [j]
              conflicts.add('stages.' + i + '.arrival')
              conflicts.add('stages.' + i + '.departure')
            } else {
              // end of [j] inside of [i]
              conflicts.add('stages.' + j + '.arrival')
              conflicts.add('stages.' + i + '.departure')
            }
          } else {
            continue
          }
        }
      }
    }
    for (const conflict of conflicts) {
      this.invalidate(conflict, 'stagesOverlapping')
    }
  }

  validateCountries() {
    const conflicts = []
    for (var i = 1; i < this.stages.length; i++) {
      if (this.stages[i - 1].endLocation.country._id !== this.stages[i].startLocation.country._id) {
        conflicts.push('stages.' + (i - 1) + '.endLocation.country')
        conflicts.push('stages.' + i + '.startLocation.country')
      }
    }
    for (const conflict of conflicts) {
      this.invalidate(conflict, 'countryChangeBetweenStages')
    }
  }
}
