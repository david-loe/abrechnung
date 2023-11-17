import Organisation from './models/organisation.js'
import Travel from './models/travel.js'
import HealthCareCost from './models/healthCareCost.js'
import ExpenseReport from './models/expenseReport.js'
import User from './models/user.js'
import Settings from './models/settings.js'

const settings = await Settings.findOne()
if (settings?.migrateFrom) {
  migrate(settings.migrateFrom)
}

async function migrate(from: string) {
  switch (from) {
    case '0.3.0':
      console.log('Appy migration from v0.3.0')
      var randomOrg = await Organisation.findOne()
      if (!randomOrg) {
        randomOrg = await new Organisation({ name: 'My Organisation' }).save()
      }
      const travels = await Travel.find()
      const healthCareCosts = await HealthCareCost.find()
      const expenseReports = await ExpenseReport.find()
      for (const travel of travels) {
        if (!travel.organisation) {
          if (travel.traveler) {
            const user = await User.findOne({ _id: travel.traveler._id }).lean()
            var org = user?.settings.organisation
            if (!org) {
              org = randomOrg
            }
            travel.organisation = org
            travel.save()
          } else {
            await travel.deleteOne()
          }
        }
      }
      for (const healthCareCost of healthCareCosts) {
        if (!healthCareCost.organisation) {
          if (healthCareCost.applicant) {
            const user = await User.findOne({ _id: healthCareCost.applicant._id }).lean()
            var org = user?.settings.organisation
            if (!org) {
              org = randomOrg
            }
            healthCareCost.organisation = org
            healthCareCost.save()
          } else {
            await healthCareCost.deleteOne()
          }
        }
      }
      for (const expenseReport of expenseReports) {
        if (!expenseReport.organisation) {
          if (expenseReport.expensePayer) {
            const user = await User.findOne({ _id: expenseReport.expensePayer._id }).lean()
            var org = user?.settings.organisation
            if (!org) {
              org = randomOrg
            }
            expenseReport.organisation = org
            expenseReport.save()
          } else {
            await expenseReport.deleteOne()
          }
        }
      }
    default:
      if (settings) {
        settings.migrateFrom = undefined
        settings.save()
      }
      break
  }
}
