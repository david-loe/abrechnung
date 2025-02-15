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
          for (let i = 0; i < report.history.length; i++) {
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
      if ('tokens' in mongoose.connection.collections) {
        await mongoose.connection.collection('tokens').dropIndex('createdAt_1')
      }
    }
    if (semver.lte(migrateFrom, '1.3.1')) {
      console.log('Apply migration from v1.3.1: Move ENV to Connection and Display Settings')
      const connectionSettingsFromEnv: any = {
        auth: {
          microsoft: {
            clientId: process.env.MS_AZURE_CLIENT_ID,
            clientSecret: process.env.MS_AZURE_CLIENT_SECRET,
            tenant: process.env.MS_AZURE_TENANT
          },
          ldapauth: {
            url: process.env.LDAP_URL,
            bindDN: process.env.LDAP_BINDDN,
            bindCredentials: process.env.LDAP_BINDCREDENTIALS,
            searchBase: process.env.LDAP_SEARCHBASE,
            searchFilter: process.env.LDAP_SEARCHFILTER,
            tlsOptions: {
              rejectUnauthorized: process.env.LDAP_TLS_REJECTUNAUTHORIZED?.toLowerCase() === 'true'
            },
            mailAttribute: process.env.LDAP_MAIL_ATTRIBUTE,
            uidAttribute: process.env.LDAP_UID_ATTRIBUTE,
            familyNameAttribute: process.env.LDAP_SURNAME_ATTRIBUTE,
            givenNameAttribute: process.env.LDAP_GIVENNAME_ATTRIBUTE
          }
        },
        smtp: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT as string),
          secure: process.env.SMTP_SECURE?.toLowerCase() === 'true',
          user: process.env.SMTP_USER,
          password: process.env.SMTP_PASS,
          senderAddress: process.env.MAIL_SENDER_ADDRESS
        }
      }
      await mongoose.connection.collection('connectionsettings').updateOne({}, { $set: connectionSettingsFromEnv })

      const displaySettingsFromEnv: any = {
        auth: {
          microsoft: process.env.VITE_AUTH_USE_MS_AZURE?.toLowerCase() === 'true',
          ldapauth: process.env.VITE_AUTH_USE_LDAP?.toLowerCase() === 'true',
          magiclogin: process.env.VITE_AUTH_USE_MAGIC_LOGIN?.toLowerCase() === 'true'
        },
        locale: {
          default: process.env.VITE_I18N_LOCALE,
          fallback: process.env.VITE_I18N_FALLBACK_LOCALE,
          overwrite: JSON.parse(process.env.VITE_I18N_LOCALES_OVERWRITE || '{"de":{},"en":{}}')
        }
      }
      await mongoose.connection.collection('displaysettings').updateOne({}, { $set: displaySettingsFromEnv })
    }
    if (semver.lte(migrateFrom, '1.4.1')) {
      console.log('Apply migration from v1.4.1: Add PDFReportsViaEmail Settings')
      const displaySettings = await mongoose.connection.collection('displaysettings').findOne({})
      await mongoose.connection
        .collection('connectionsettings')
        .updateOne(
          {},
          { $set: { PDFReportsViaEmail: { sendPDFReportsToOrganisationEmail: false, locale: displaySettings?.locale?.default || 'de' } } }
        )
    }
    if (semver.lte(migrateFrom, '1.5.2')) {
      console.log('Apply migration from v1.5.2: Add log to reports')
      async function writeLogFromHistory(collection: string) {
        const allReports = mongoose.connection.collection(collection).find({ historic: false })
        for await (const report of allReports) {
          for (let i = 0; i < report.history.length; i++) {
            const history = await mongoose.connection.collection(collection).findOne({ _id: report.history[i] })
            if (history) {
              const set = { $set: {} as any }
              set.$set[`log.${history.state}`] = { date: history.updatedAt, editor: history.editor }
              mongoose.connection.collection(collection).updateOne({ _id: report._id }, set)
            }
          }
        }
      }
      await writeLogFromHistory('travels')
      await writeLogFromHistory('expensereports')
      await writeLogFromHistory('healthcarecosts')
    }
    if (settings) {
      settings.migrateFrom = undefined
      await settings.save()
    }
  }
}
