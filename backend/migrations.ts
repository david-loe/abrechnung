import mongoose from 'mongoose'
import { distanceRefundTypes } from '../common/types.js'
import { initDB } from './db.js'
import ExpenseReport from './models/expenseReport.js'
import HealthCareCost from './models/healthCareCost.js'
import Organisation from './models/organisation.js'
import Settings from './models/settings.js'
import Travel from './models/travel.js'
import User from './models/user.js'

export async function checkForMigrations() {
  const settings = await Settings.findOne()
  if (settings?.migrateFrom) {
    switch (settings.migrateFrom) {
      case '0.3.0': {
        console.log('Apply migration from v0.3.0')
        var randomOrg = await Organisation.findOne()
        if (!randomOrg) {
          randomOrg = (await new Organisation({ name: 'My Organisation' }).save()).toObject()
        }
        const travels = await Travel.find()
        const healthCareCosts = await HealthCareCost.find()
        const expenseReports = await ExpenseReport.find()
        for (const travel of travels) {
          //@ts-ignore
          if (!travel.organisation) {
            //@ts-ignore
            if (travel.traveler) {
              //@ts-ignore
              const user = await User.findOne({ _id: travel.traveler._id }).lean() //@ts-ignore
              var org = user?.settings.organisation
              if (!org) {
                org = randomOrg
              } //@ts-ignore
              travel.organisation = org
              travel.save()
            } else {
              await travel.deleteOne()
            }
          }
        }
        for (const healthCareCost of healthCareCosts) {
          //@ts-ignore
          if (!healthCareCost.organisation) {
            //@ts-ignore
            if (healthCareCost.applicant) {
              //@ts-ignore
              const user = await User.findOne({ _id: healthCareCost.applicant._id }).lean() //@ts-ignore
              var org = user?.settings.organisation
              if (!org) {
                org = randomOrg
              } //@ts-ignore
              healthCareCost.organisation = org
              healthCareCost.save()
            } else {
              await healthCareCost.deleteOne()
            }
          }
        }
        for (const expenseReport of expenseReports) {
          //@ts-ignore
          if (!expenseReport.organisation) {
            //@ts-ignore
            if (expenseReport.expensePayer) {
              //@ts-ignore
              const user = await User.findOne({ _id: expenseReport.expensePayer._id }).lean() //@ts-ignore
              var org = user?.settings.organisation
              if (!org) {
                org = randomOrg
              } //@ts-ignore
              expenseReport.organisation = org
              expenseReport.save()
            } else {
              await expenseReport.deleteOne()
            }
          }
        }
      }
      case '0.3.2': {
        console.log('Apply migration from v0.3.2')
        const allTravels = mongoose.connection.collection('travels').find()
        for await (const travel of allTravels) {
          for (const stage of travel.stages) {
            stage.transport = {
              type: stage.transport,
              distance: stage.distance,
              distanceRefundType: stage.transport === 'ownCar' ? distanceRefundTypes[0] : null
            }
          }
          mongoose.connection.collection('travels').updateOne({ _id: travel._id }, { $set: { stages: travel.stages } })
        }
      }
      case '0.3.3': {
        console.log('Apply migration from v0.3.3')
        await mongoose.connection.collection('countries').drop()
        initDB()
      }
      case '0.3.4': {
        console.log('Apply migration from v0.3.4')
        mongoose.connection.collection('users').updateMany({}, { $set: { 'access.user': true } })
      }
      case '0.3.5': {
        console.log('Apply migration from v0.3.5')
        const travels = await Travel.find()
        for (const travel of travels) {
          if (travel.state === 'refunded' || travel.state === 'underExamination') {
            //@ts-ignore
            travel.lastPlaceOfWork = { country: travel.stages[travel.stages.length - 1].endLocation.country }
          } else {
            //@ts-ignore
            travel.lastPlaceOfWork = { country: travel.destinationPlace.country }
          }
          try {
            await travel.save()
          } catch (error: any) {
            console.error(
              'Failed migrating travel: ' + travel._id,
              Object.values(error.errors).map((val: any) => val.message)
            )
          }
        }
      }
      case '0.3.7': {
        console.log('Apply migration from v0.3.7')
        mongoose.connection.collection('travels').updateMany({}, { $rename: { traveler: 'owner' } })
        mongoose.connection.collection('expensereports').updateMany({}, { $rename: { expensePayer: 'owner' } })
        mongoose.connection.collection('healthcarecosts').updateMany({}, { $rename: { applicant: 'owner' } })
      }
      case '0.3.9': {
        console.log('Apply migration from v0.3.9')
        const project = await mongoose.connection.collection('projects').findOne({})
        if (project) {
          mongoose.connection.collection('travels').updateMany({}, { $set: { project: project._id } })
          mongoose.connection.collection('expensereports').updateMany({}, { $set: { project: project._id } })
          mongoose.connection.collection('healthcarecosts').updateMany({}, { $set: { project: project._id } })
        } else {
          throw new Error('No project found')
        }
      }
      case '0.3.10': {
        console.log('Apply migration from v0.3.10: Set default access settings')
        mongoose.connection.collection('users').updateMany(
          {},
          {
            $set: {
              'access.inWork:expenseReport': true,
              'access.inWork:healthCareCost': true,
              'access.appliedFor:travel': true,
              'access.approved:travel': false
            }
          }
        )
      }
      case '0.4.0': {
        console.log('Apply migration from v0.4.0: Reload Countries (fix typo)')
        await mongoose.connection.collection('countries').drop()
        await initDB()
      }
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
            secoundNightOnShipOrFerryLumpSumCountry: oldSettings.secoundNightOnShipOrFerryLumpSumCountry
          }
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
