import mongoose from 'mongoose'
import semver from 'semver'
import Settings from './models/settings.js'

export async function checkForMigrations() {
  const settings = await Settings.findOne()
  if (settings?.migrateFrom) {
    const migrateFrom = settings?.migrateFrom
    if (semver.lte(migrateFrom, '1.1.0')) {
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
    if (semver.lte(migrateFrom, '1.2.0')) {
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
    if (semver.lte(migrateFrom, '1.2.3')) {
      console.log('Apply migration from v1.2.3: Move projects from settings.projects to projects.assigned')
      await mongoose.connection.collection('users').updateMany({}, { $rename: { 'settings.projects': 'projects.assigned' } })
    }
    if (semver.lte(migrateFrom, '1.2.6')) {
      console.log('Apply migration from v1.2.6: Fix Settings')
      await mongoose.connection.collection('settings').updateMany(
        {},
        {
          $rename: {
            'travelSettings.secoundNightOnAirplaneLumpSumCountry': 'travelSettings.secondNightOnAirplaneLumpSumCountry',
            'travelSettings.secoundNightOnShipOrFerryLumpSumCountry': 'travelSettings.secondNightOnShipOrFerryLumpSumCountry'
          }
        }
      )
      await mongoose.connection.collection('tokens').dropIndex('createdAt_1')
    }

    if (settings) {
      settings.migrateFrom = undefined
      await settings.save()
    }
  }
}
