import mongoose from 'mongoose'
import semver from 'semver'
import { formatter } from './factory.js'
import { logger } from './logger.js'
import Settings from './models/settings.js'

export async function checkForMigrations() {
  const settings = await Settings.findOne()
  if (settings?.migrateFrom) {
    const migrateFrom = settings?.migrateFrom
    const minVersion = '2.0.0'
    if (semver.lt(migrateFrom, minVersion)) {
      throw new Error(`Migration from v${migrateFrom} to v${settings.version} not supported. Migrate to v${minVersion} first.`)
    }

    if (semver.lte(migrateFrom, '2.0.1')) {
      logger.info('Apply migration from v2.0.1: add help button settings')

      await mongoose.connection
        .collection('displaysettings')
        .updateOne({}, { $set: { helpButton: { enabled: true, examinersMail: true, examinersMsTeams: true, customOptions: [] } } })
    }

    if (semver.lte(migrateFrom, '2.0.4')) {
      logger.info('Apply migration from v2.0.4: rewrite states')

      await mongoose.connection
        .collection('displaysettings')
        .updateOne(
          {},
          {
            $set: {
              stateColors: {
                '-10': { color: '#E8998D', text: 'black' },
                '0': { color: '#cae5ff', text: 'black' },
                '10': { color: '#89BBFE', text: 'black' },
                '20': { color: '#6f8ab7', text: 'white' },
                '30': { color: '#615d6c', text: 'white' },
                '40': { color: '#5E8C61', text: 'white' }
              }
            }
          }
        )
      // biome-ignore-start lint/suspicious/noThenProperty: mongodb uses then
      const switchTravelStates = (field: string) => ({
        $switch: {
          branches: [
            { case: { $eq: [field, 'rejected'] }, then: -10 },
            { case: { $eq: [field, 'appliedFor'] }, then: 0 },
            { case: { $eq: [field, 'approved'] }, then: 10 },
            { case: { $eq: [field, 'underExamination'] }, then: 20 },
            { case: { $eq: [field, 'refunded'] }, then: 30 }
          ],
          default: field
        }
      })
      await mongoose.connection
        .collection('travels')
        .updateMany({}, [
          {
            $set: {
              state: switchTravelStates('$state'),
              comments: {
                $map: {
                  input: '$comments',
                  as: 'comment',
                  in: { $mergeObjects: ['$$comment', { toState: switchTravelStates('$$comment.toState') }] }
                }
              }
            }
          }
        ])
      const switchExpenseReportStates = (field: string) => ({
        $switch: {
          branches: [
            { case: { $eq: [field, 'inWork'] }, then: 10 },
            { case: { $eq: [field, 'underExamination'] }, then: 20 },
            { case: { $eq: [field, 'refunded'] }, then: 30 }
          ],
          default: field
        }
      })
      await mongoose.connection
        .collection('expensereports')
        .updateMany({}, [
          {
            $set: {
              state: switchExpenseReportStates('$state'),
              comments: {
                $map: {
                  input: '$comments',
                  as: 'comment',
                  in: { $mergeObjects: ['$$comment', { toState: switchExpenseReportStates('$$comment.toState') }] }
                }
              }
            }
          }
        ])
      const switchHealthCareCostStates = (field: string) => ({
        $switch: {
          branches: [
            { case: { $eq: [field, 'inWork'] }, then: 10 },
            { case: { $eq: [field, 'underExamination'] }, then: 20 },
            { case: { $eq: [field, 'underExaminationByInsurance'] }, then: 30 },
            { case: { $eq: [field, 'refunded'] }, then: 30 }
          ],
          default: field
        }
      })
      await mongoose.connection
        .collection('healthcarecosts')
        .updateMany({}, [
          {
            $set: {
              state: switchHealthCareCostStates('$state'),
              comments: {
                $map: {
                  input: '$comments',
                  as: 'comment',
                  in: { $mergeObjects: ['$$comment', { toState: switchHealthCareCostStates('$$comment.toState') }] }
                }
              }
            }
          }
        ])
      const switchAdvancesStates = (field: string) => ({
        $switch: {
          branches: [
            { case: { $eq: [field, 'rejected'] }, then: -10 },
            { case: { $eq: [field, 'appliedFor'] }, then: 0 },
            { case: { $eq: [field, 'approved'] }, then: 30 },
            { case: { $eq: [field, 'completed'] }, then: 30 }
          ],
          default: field
        }
      })
      await mongoose.connection
        .collection('advances')
        .updateMany({}, [
          {
            $set: {
              state: switchAdvancesStates('$state'),
              comments: {
                $map: {
                  input: '$comments',
                  as: 'comment',
                  in: { $mergeObjects: ['$$comment', { toState: switchAdvancesStates('$$comment.toState') }] }
                }
              },
              settledOn: '$log.approved.date'
            }
          }
        ])
      // biome-ignore-end lint/suspicious/noThenProperty: mongodb uses then
      const logRenameTraAdv = (approvedState = 10) => ({
        $rename: {
          'log.rejected': 'log.-10',
          'log.appliedFor': 'log.0',
          'log.approved': `log.${approvedState}`,
          'log.underExamination': 'log.20'
        }
      })
      const logRenameExpHea = {
        $rename: {
          'log.inWork': 'log.10',
          'log.underExamination': 'log.20'
          // 'log.underExaminationByInsurance' left as is
        }
      }
      await mongoose.connection.collection('travels').updateMany({}, logRenameTraAdv(10))
      await mongoose.connection.collection('expensereports').updateMany({}, logRenameExpHea)
      await mongoose.connection.collection('healthcarecosts').updateMany({}, logRenameExpHea)
      await mongoose.connection.collection('advances').updateMany({}, logRenameTraAdv(30))
      await mongoose.connection
        .collection('users')
        .updateMany(
          {},
          {
            $rename: {
              'access.approved/advance': 'access.book/advance',
              'access.refunded/travel': 'access.book/travel',
              'access.refunded/expenseReport': 'access.book/expenseReport',
              'access.refunded/healthCareCost': 'access.book/healthCareCost'
            }
          }
        )
      await mongoose.connection
        .collection('displaysettings')
        .updateMany(
          {},
          {
            $rename: {
              'accessIcons.approved/advance': 'accessIcons.book/advance',
              'accessIcons.refunded/travel': 'accessIcons.book/travel',
              'accessIcons.refunded/expenseReport': 'accessIcons.book/expenseReport',
              'accessIcons.refunded/healthCareCost': 'accessIcons.book/healthCareCost'
            }
          }
        )
    }
    if (semver.lte(migrateFrom, '2.1.0')) {
      logger.info('Apply migration from v2.1.0: add name display format setting')

      await mongoose.connection.collection('displaysettings').updateOne({}, { $set: { nameDisplayFormat: 'givenNameFirst' } })
    }
    if (semver.lte(migrateFrom, '2.1.2')) {
      logger.info('Apply migration from v2.1.2: rewrite log')

      const advanceMap = { 0: 30, 30: 40, 40: 40 } as const
      const otherMap = { 0: 10, 10: 20, 20: 30, 30: 40, 40: 40 } as const

      function rewriteLog(
        oldLog: {
          [key in number]?: { date: Date; editor: mongoose.Types.ObjectId }
        },
        map: { [key in number]: number }
      ) {
        const newLog: { [key in number]?: { on: Date; by: mongoose.Types.ObjectId } } = {}
        for (const key in oldLog) {
          if (oldLog[key] && map[key]) {
            newLog[map[key]] = { on: oldLog[key].date, by: oldLog[key].editor }
          }
        }
        return newLog
      }
      async function bulkRewriteLog(collectionName: string) {
        const docs = mongoose.connection.collection(collectionName).find({})
        const map = collectionName === 'advances' ? advanceMap : otherMap
        for await (const doc of docs) {
          await mongoose.connection.collection(collectionName).updateOne({ _id: doc._id }, { $set: { log: rewriteLog(doc.log, map) } })
        }
      }
      await bulkRewriteLog('travels')
      await bulkRewriteLog('expensereports')
      await bulkRewriteLog('healthcarecosts')
      await bulkRewriteLog('advances')
    }

    if (semver.lte(migrateFrom, '2.1.3')) {
      logger.info('Apply migration from v2.1.3: add approved travels')

      const travels = await mongoose.connection
        .model('Travel')
        .find({ historic: false, state: { $gte: 10 } })
        .lean() //APPROVED or higher
      const approvedTravels = []
      for (const travel of travels) {
        approvedTravels.push({
          startDate: travel.startDate,
          endDate: travel.endDate,
          reason: travel.reason,
          destinationPlace: travel.destinationPlace,
          claimSpouseRefund: travel.claimSpouseRefund,
          fellowTravelersNames: travel.fellowTravelersNames,
          traveler: formatter.name(travel.owner.name),
          approvedBy: formatter.name(travel.log[10]?.by.name), //APPROVED
          approvedOn: travel.log[10]?.on as Date, //APPROVED
          appliedForOn: travel.log[0]?.on || travel.createdAt, //APPLIED_FOR
          reportId: travel._id,
          organisationId: travel.project.organisation
        })
      }
      if (approvedTravels.length > 0) {
        await mongoose.connection.collection('approvedtravels').insertMany(approvedTravels)
      }
    }

    if (settings) {
      settings.migrateFrom = undefined
      await settings.save()
    }
  }
}
