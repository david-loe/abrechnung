import mongoose from 'mongoose'
import semver from 'semver'
import { addUp, getBaseCurrencyAmount } from '../common/scripts.js'
import { logger } from './logger.js'
import { addExchangeRate } from './models/exchangeRate.js'
import Settings from './models/settings.js'

export async function checkForMigrations() {
  const settings = await Settings.findOne()
  if (settings?.migrateFrom) {
    const migrateFrom = settings?.migrateFrom
    if (semver.lt(migrateFrom, '1.7.0')) {
      throw new Error(`Migration from v${migrateFrom} to v${settings.version} not supported. Migrate to at least v1.7.0 first.`)
    }

    if (semver.eq(migrateFrom, '1.7.0')) {
      logger.info('Apply migration from v1.7.0: redesign settings')
      const { travelSettings, accessIcons, stateColors } = (await mongoose.connection.collection('settings').findOne({})) as any

      for (const key in accessIcons as Record<string, string[]>) {
        for (let i = 0; i < accessIcons[key].length; i++) {
          if (accessIcons[key][i].startsWith('bi-')) {
            accessIcons[key][i] = accessIcons[key][i].slice(3)
          }
        }
      }

      delete travelSettings._id
      delete accessIcons._id
      delete stateColors._id

      await mongoose.connection.collection('travelsettings').updateOne({}, { $set: travelSettings })
      await mongoose.connection.collection('displaysettings').updateOne({}, { $set: { accessIcons, stateColors } })
      await mongoose.connection.collection('settings').updateOne({}, { $unset: { accessIcons: '', stateColors: '', travelSettings: '' } })
    }

    if (semver.lte(migrateFrom, '1.7.2')) {
      logger.info('Apply migration from v1.7.1: migrate travel.days.refunds to lumpSums')

      const travels = await mongoose.model('Travel').find({})
      for (const travel of travels) {
        if (travel.days.length > 0) {
          for (const day of travel.days) {
            if (!day.cateringRefund) {
              day.cateringRefund = {
                breakfast: !day.cateringNoRefund?.breakfast,
                lunch: !day.cateringNoRefund?.lunch,
                dinner: !day.cateringNoRefund?.dinner
              }
              day.overnightRefund = Boolean(travel.claimOvernightLumpSum)
            }
          }
          try {
            await travel.save({ timestamps: false })
          } catch (e) {
            if (!travel.historic) {
              logger.warn(`Travel (${travel._id.toString()}) not save: ${e}`)
            }
          }
        }
      }
      await mongoose.connection
        .collection('travels')
        .updateMany({}, { $unset: { 'days.$[].cateringNoRefund': '', claimOvernightLumpSum: '' } })
    }

    if (semver.lte(migrateFrom, '1.7.4')) {
      logger.info('Apply migration from v1.7.4: rewrite advances')

      await mongoose.connection.collection('displaysettings').updateOne(
        {},
        {
          $set: {
            'stateColors.completed': { color: '#615d6c', text: 'white' },
            'accessIcons.appliedFor:advance': ['briefcase', 'cash-coin', 'plus'],
            'accessIcons.approve/travel': ['airplane', 'clipboard-check'],
            'accessIcons.approve/advance': ['briefcase', 'cash-coin', 'clipboard-check'],
            'accessIcons.approved/advance': ['briefcase', 'cash-coin', 'bank'],
            reportTypeIcons: {
              travel: ['airplane'],
              expenseReport: ['coin'],
              advance: ['briefcase', 'cash-coin'],
              healthCareCost: ['hospital']
            }
          }
        }
      )
      const travelApprover = await mongoose.connection.collection('users').findOne({ 'access.approve/travel': true })
      async function rewriteAdvance(collection: string) {
        const allReports = mongoose.connection.collection(collection).find({ historic: false })
        for await (const report of allReports) {
          try {
            if (report.advance?.amount) {
              if (report.advance.currency !== 'EUR' && !report.advance.exchangeRate) {
                await addExchangeRate(report.advance, report.createdAt)
              }
              const amount = getBaseCurrencyAmount(report.advance)
              if (report.state === 'refunded') {
                report.advances = [{ balance: { amount: amount } }]
                await mongoose.connection
                  .collection(collection)
                  .updateOne({ _id: report._id }, { $set: { addUp: addUp(report as any), advances: [] } })
                continue
              }
              if (report.state !== 'rejected') {
                const advance = new (mongoose.connection.model('Advance'))({
                  name: report.name,
                  reason: report.name,
                  budget: report.advance,
                  balance: { amount: amount },
                  owner: report.owner,
                  project: report.project,
                  log:
                    report.state === 'appliedFor'
                      ? {}
                      : { appliedFor: report.log.appliedFor ?? { date: report.createdAt, editor: travelApprover?._id } },
                  state: report.state === 'appliedFor' ? 'appliedFor' : 'approved',
                  editor: report.state === 'appliedFor' ? report.editor : travelApprover?._id
                })
                await advance.save()
                report.advances = [advance]
                await mongoose.connection
                  .collection(collection)
                  .updateOne({ _id: report._id }, { $set: { addUp: addUp(report as any), advances: [advance._id] } })
                continue
              }
            }
            report.advances = []
            await mongoose.connection
              .collection(collection)
              .updateOne({ _id: report._id }, { $set: { addUp: addUp(report as any), advances: [] } })
          } catch (e) {
            logger.warn(`${collection}: ${report._id.toString()} not save: ${e}`)
          }
        }
      }

      await rewriteAdvance('travels')
      await rewriteAdvance('expensereports')
      await rewriteAdvance('healthcarecosts')

      logger.info('Apply migration from v1.7.4: add expense report categories')
      const defaultCategory = await mongoose.connection.collection('categories').findOne()
      await mongoose.connection.collection('expensereports').updateMany({}, { $set: { category: defaultCategory?._id } })
    }
    if (semver.lte(migrateFrom, '2.0.1')) {
      logger.info('Apply migration from v2.0.1: add help button settings')

      await mongoose.connection
        .collection('displaysettings')
        .updateOne({}, { $set: { helpButton: { enabled: true, examinersMail: true, examinersMsTeams: true, customOptions: [] } } })
    }

    if (semver.lte(migrateFrom, '2.0.4')) {
      logger.info('Apply migration from v2.0.4: rewrite states')

      await mongoose.connection.collection('displaysettings').updateOne(
        {},
        {
          $set: {
            stateColors: {
              '-10': { color: '#E8998D', text: 'black' },
              '0': { color: '#cae5ff', text: 'black' },
              '10': { color: '#89BBFE', text: 'black' },
              '20': { color: '#6f8ab7', text: 'white' },
              '30': { color: '#615d6c', text: 'white' },
              '31': { color: '#65697F', text: 'white' },
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
      await mongoose.connection.collection('travels').updateMany({}, [
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
      await mongoose.connection.collection('expensereports').updateMany({}, [
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
            { case: { $eq: [field, 'refunded'] }, then: 31 }
          ],
          default: field
        }
      })
      await mongoose.connection.collection('healthcarecosts').updateMany({}, [
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
      await mongoose.connection.collection('advances').updateMany({}, [
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
          'log.underExamination': 'log.20',
          'log.underExaminationByInsurance': 'log.30'
        }
      }
      await mongoose.connection.collection('travels').updateMany({}, logRenameTraAdv(10))
      await mongoose.connection.collection('expensereports').updateMany({}, logRenameExpHea)
      await mongoose.connection.collection('healthcarecosts').updateMany({}, logRenameExpHea)
      await mongoose.connection.collection('advances').updateMany({}, logRenameTraAdv(30))
    }

    if (settings) {
      settings.migrateFrom = undefined
      await settings.save()
    }
  }
}
