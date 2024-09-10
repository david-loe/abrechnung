import mongoose from 'mongoose'
import Settings from './models/settings.js'

export async function checkForMigrations() {
  const settings = await Settings.findOne()
  if (settings?.migrateFrom) {
    switch (settings.migrateFrom) {
      case '1.1.0': {
        console.log('Apply migration from v1.1.0: Rewrite history dates to reflect submission date')
        async function rewriteSubmissionDate(collection: string, state: string) {
          const allReports = mongoose.connection.collection(collection).find({ historic: false })
          for await (const report of allReports) {
            for (var i = 0; i < report.history.length; i++) {
              const history = await mongoose.connection.collection(collection).findOne({ _id: report.history[i] })
              if (history && history.state === state) {
                let submissionDate = report.updatedAt
                mongoose.connection.collection(collection).updateOne({ _id: report.history[i] }, { $set: { updatedAt: submissionDate } })
                break
              }
            }
          }
        }
        await rewriteSubmissionDate('travels', 'approved')
        await rewriteSubmissionDate('expensereports', 'inWork')
        await rewriteSubmissionDate('healthcarecosts', 'inWork')
      }
      case '1.2.0': {
        console.log('Apply migration from v1.2.0: New settings structure')
        const oldSettings = await mongoose.connection.collection('settings').findOne()
        if (settings && oldSettings) {
          settings.travelSettings = {
            maxTravelDayCount: oldSettings.maxTravelDayCount,
            allowSpouseRefund: oldSettings.allowSpouseRefund,
            allowTravelApplicationForThePast: oldSettings.allowTravelApplicationForThePast,
            toleranceStageDatesToApprovedTravelDates: oldSettings.toleranceStageDatesToApprovedTravelDates,
            distanceRefunds: oldSettings.distanceRefunds,
            vehicleRegistrationWhenUsingOwnCar: oldSettings.vehicleRegistrationWhenUsingOwnCar,
            lumpSumCut: {
              breakfast: oldSettings.breakfastCateringLumpSumCut,
              lunch: oldSettings.lunchCateringLumpSumCut,
              dinner: oldSettings.dinnerCateringLumpSumCut
            },
            factorCateringLumpSum: oldSettings.factorCateringLumpSum,
            factorCateringLumpSumExceptions: oldSettings.factorCateringLumpSumExceptions,
            factorOvernightLumpSum: oldSettings.factorOvernightLumpSum,
            factorOvernightLumpSumExceptions: oldSettings.factorOvernightLumpSumExceptions,
            fallBackLumpSumCountry: oldSettings.fallBackLumpSumCountry,
            secoundNightOnAirplaneLumpSumCountry: oldSettings.secoundNightOnAirplaneLumpSumCountry,
            secoundNightOnShipOrFerryLumpSumCountry: oldSettings.secoundNightOnShipOrFerryLumpSumCountry,
            minHoursOfTravel: 8, // fix migration failing
            minProfessionalShare: 0.5 // fix migration failing
          } as any
          await settings.save()
        } else {
          throw Error("Couldn't find settings")
        }
      }
      default:
        if (settings) {
          settings.migrateFrom = undefined
          await settings.save()
        }
        break
    }
  }
}
