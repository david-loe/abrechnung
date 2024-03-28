import mongoose from 'mongoose'
import { distanceRefundTypes } from '../common/types.js'
import { initDB } from './db.js'
import ExpenseReport from './models/expenseReport.js'
import HealthCareCost from './models/healthCareCost.js'
import Organisation from './models/organisation.js'
import Settings from './models/settings.js'
import Travel from './models/travel.js'
import User from './models/user.js'

const settings = await Settings.findOne()
if (settings?.migrateFrom) {
  migrate(settings.migrateFrom)
}

async function migrate(from: string) {
  switch (from) {
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
    default:
      if (settings) {
        settings.migrateFrom = undefined
        settings.save()
      }
      break
  }
}
