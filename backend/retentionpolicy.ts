import { CronJob } from 'cron'
import Settings from './models/settings.js'
import Travel from './models/travel.js'

async function deleteOldTravels(days: number) {
  const dateThreshold = new Date()
  dateThreshold.setDate(dateThreshold.getDate() - days)
  try {
    const result = await Travel.deleteMany({ state: 'refunded', updatedAt: { $lt: dateThreshold } })
    console.log(`Deleted ${result.deletedCount} travels older than ${days} days`)
  } catch (error) {
    console.error('Error deleting travels:', error)
  }
}

async function getSettings() {
  return await Settings.findOne({}).lean()
}

const job = new CronJob('0 3 * * *', async () => {
  const settings = await getSettings()
  console.log('jeden Tag um 3:00 Uhr wird das hier ausgeführt')
  const currenttime = new Date()
  currenttime.setDate(currenttime.getDate())
  console.log(currenttime)
  if (settings) {
    await deleteOldTravels(settings.deleteRefundedTravelAfterXDays)
  } else {
    console.error('Settings not found!')
  }
})

job.start()
