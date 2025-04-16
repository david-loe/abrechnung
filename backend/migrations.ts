import mongoose from 'mongoose'
import semver from 'semver'
import { addUp } from '../common/scripts.js'
import { logger } from './logger.js'
import Settings from './models/settings.js'

export async function checkForMigrations() {
  const settings = await Settings.findOne()
  if (settings?.migrateFrom) {
    const migrateFrom = settings?.migrateFrom
    if (semver.lte(migrateFrom, '1.2.3')) {
      logger.info('Apply migration from v1.2.3: Move projects from settings.projects to projects.assigned')
      await mongoose.connection.collection('users').updateMany({}, { $rename: { 'settings.projects': 'projects.assigned' } })
    }
    if (semver.lte(migrateFrom, '1.2.6')) {
      logger.info('Apply migration from v1.2.6: Fix Settings')
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
      logger.info('Apply migration from v1.3.1: Move ENV to Connection and Display Settings')
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
          port: Number.parseInt(process.env.SMTP_PORT as string),
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
      logger.info('Apply migration from v1.4.1: Add PDFReportsViaEmail Settings')
      const displaySettings = await mongoose.connection.collection('displaysettings').findOne({})
      await mongoose.connection
        .collection('connectionsettings')
        .updateOne(
          {},
          { $set: { PDFReportsViaEmail: { sendPDFReportsToOrganisationEmail: false, locale: displaySettings?.locale?.default || 'de' } } }
        )
    }

    if (semver.lte(migrateFrom, '1.5.2')) {
      logger.info('Apply migration from v1.5.2: Add log to reports')
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

    if (semver.lte(migrateFrom, '1.5.4')) {
      logger.info('Apply migration from v1.5.4: Add needsA1Certificate to countries')
      // prettier-ignore
      const a1countries = [
        // andere Mitgliedstaaten der Europäischen Union (EU)
        'AT',
        'BE',
        'BG',
        'HR',
        'CY',
        'CZ',
        'DK',
        'EE',
        'FI',
        'FR',
        'PL',
        'GR',
        'HU',
        'IE',
        'IT',
        'LV',
        'LT',
        'LU',
        'MT',
        'NL',
        'PT',
        'RO',
        'SK',
        'SI',
        'ES',
        'SE', // "DE" not
        // Weitere europäische Länder
        'IS',
        'LI',
        'NO',
        'CH',
        'GB'
      ] as const
      await mongoose.connection
        .collection<{ _id: string }>('countries')
        .updateMany({ _id: { $in: a1countries } }, { $set: { needsA1Certificate: true } })
    }

    if (semver.lte(migrateFrom, '1.5.4')) {
      logger.info('Apply migration from v1.5.4: migrate travelInsideOfEU to isCrossBorder and a1Certificate')

      await mongoose.connection.collection<{ _id: string }>('travels').updateMany({ travelInsideOfEU: true }, [
        {
          $set: {
            isCrossBorder: true,
            a1Certificate: {
              exactAddress: '$destinationPlace.place',
              destinationName: '$destinationPlace.place'
            }
          }
        }
      ])
    }

    if (semver.lte(migrateFrom, '1.6.2')) {
      logger.info('Apply migration from v1.6.2: add addUp to all reports')

      async function calcAddUp(collection: string) {
        const allReports = mongoose.connection.collection(collection).find()
        for await (const report of allReports) {
          mongoose.connection.collection(collection).updateOne({ _id: report._id }, { $set: { addUp: addUp(report as any) } })
        }
      }

      await calcAddUp('travels')
      await calcAddUp('expensereports')
      await calcAddUp('healthcarecosts')
    }

    if (semver.lte(migrateFrom, '1.7.0')) {
      logger.info('Apply migration from v1.7.0: redesign settings')
      const { travelSettings, accessIcons, stateColors } = (await mongoose.connection.collection('settings').findOne({})) as any

      for (const key in accessIcons as Record<string, string[]>) {
        for (let i = 0; i < accessIcons[key].length; i++) {
          if (accessIcons[key][i].startsWith('bi-')) {
            accessIcons[key][i] = accessIcons[key][i].slice(3)
          }
        }
      }

      await mongoose.connection.collection('travelsettings').updateOne({}, { $set: travelSettings })
      await mongoose.connection.collection('displaysettings').updateOne({}, { $set: { accessIcons, stateColors } })
      await mongoose.connection.collection('settings').updateOne({}, { $unset: { accessIcons: '', stateColors: '', travelSettings: '' } })
    }

    if (settings) {
      settings.migrateFrom = undefined
      await settings.save()
    }
  }
}
