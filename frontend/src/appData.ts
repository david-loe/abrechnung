import { Ref, ref } from 'vue'
import { loadLocales } from '../../common/locales/load'
import {
  CountrySimple,
  Currency,
  DisplaySettings,
  HealthInsurance,
  Locale,
  OrganisationSimple,
  ProjectSimple,
  Settings,
  User
} from '../../common/types'
import API from './api.js'
import i18n from './i18n'
import { logger } from './logger'

export class APP_DATA {
  currencies: Currency[]
  countries: CountrySimple[]
  user: User
  settings: Settings
  displaySettings: DisplaySettings
  healthInsurances: HealthInsurance[]
  organisations: OrganisationSimple[]
  specialLumpSums: { [key: string]: string[] }

  projects?: ProjectSimple[]
  users?: { name: User['name']; _id: string }[]

  constructor(
    currencies: Currency[],
    countries: CountrySimple[],
    user: User,
    settings: Settings,
    displaySettings: DisplaySettings,
    healthInsurances: HealthInsurance[],
    organisations: OrganisationSimple[],

    specialLumpSums: { [key: string]: string[] },
    projects?: ProjectSimple[],
    users?: { name: User['name']; _id: string }[]
  ) {
    this.currencies = currencies
    this.countries = countries
    this.user = user
    this.settings = settings
    this.displaySettings = displaySettings
    this.healthInsurances = healthInsurances
    this.organisations = organisations
    this.specialLumpSums = specialLumpSums

    this.projects = projects
    this.users = users
  }
}

class APP_LOADER {
  dataPromise?: Promise<APP_DATA>
  displaySettingsPromise?: Promise<DisplaySettings>
  state: Ref<'UNLOADED' | 'LOADING' | 'LOADED'> = ref('UNLOADED')
  progress = ref(0)
  progressIncrement = 10 // 10 * 10 = 100

  loadData(reload = false) {
    if (this.dataPromise === undefined || reload) {
      this.state.value = 'LOADING'
      this.progress.value = 0
      this.dataPromise = new Promise((resolve, reject) => {
        Promise.allSettled([
          Promise.all([
            this.withProgress(API.getter<User>('user')),
            this.withProgress(API.getter<Currency[]>('currency')),
            this.withProgress(API.getter<CountrySimple[]>('country')),
            this.withProgress(API.getter<Settings>('settings')),
            this.withProgress(API.getter<HealthInsurance[]>('healthInsurance')),
            this.withProgress(API.getter<OrganisationSimple[]>('organisation')),
            this.withProgress(API.getter<{ [key: string]: string[] }>('specialLumpSums')),
            this.withProgress(API.getter<DisplaySettings>('displaySettings'))
          ]),
          Promise.allSettled([
            this.withProgress(API.getter<ProjectSimple[]>('project', {}, {}, false)),
            this.withProgress(API.getter<{ name: User['name']; _id: string }[]>('users', {}, {}, false))
          ])
        ]).then((result) => {
          if (result[0].status === 'rejected') {
            reject(result[0].reason)
          } else {
            const [
              userRes,
              currenciesRes,
              countriesRes,
              settingsRes,
              healthInsurancesRes,
              organisationsRes,
              specialLumpSumsRes,
              displaySettingsRes
            ] = result[0].value

            let projects,
              users = undefined
            if (result[1].status === 'fulfilled') {
              projects = result[1].value[0].status === 'fulfilled' ? result[1].value[0].value : undefined
              users = result[1].value[1].status === 'fulfilled' ? result[1].value[1].value : undefined
            }
            if (
              !userRes.ok ||
              !currenciesRes.ok ||
              !countriesRes.ok ||
              !settingsRes.ok ||
              !healthInsurancesRes.ok ||
              !organisationsRes.ok ||
              !specialLumpSumsRes.ok ||
              !displaySettingsRes.ok
            ) {
              reject('Error loading essential data')
            }
            resolve(
              new APP_DATA(
                currenciesRes.ok!.data,
                countriesRes.ok!.data,
                userRes.ok!.data,
                settingsRes.ok!.data,
                displaySettingsRes.ok!.data,
                healthInsurancesRes.ok!.data,
                organisationsRes.ok!.data,
                specialLumpSumsRes.ok!.data,
                projects?.ok?.data,
                users?.ok?.data
              )
            )
            this.state.value = 'LOADED'
            this.updateLocales(displaySettingsRes.ok!.data)
            logger.info(i18n.global.t('labels.user') + ':')
            logger.info(userRes.ok!.data)
          }
        })
      })
    }
    return this.dataPromise
  }

  loadDisplaySettings(reload = false) {
    if (this.displaySettingsPromise === undefined || reload) {
      this.state.value = 'LOADING'
      this.displaySettingsPromise = new Promise((resolve, reject) => {
        API.getter<DisplaySettings>('displaySettings').then((result) => {
          if (result.ok) {
            resolve(result.ok.data)
            this.state.value = 'LOADED'
            this.updateLocales(result.ok.data)
          } else {
            reject(result.error)
          }
        })
      })
    }
    return this.displaySettingsPromise
  }

  updateLocales(displaySettings: DisplaySettings) {
    const messages = loadLocales(displaySettings.locale.overwrite)
    for (const locale in messages) {
      i18n.global.setLocaleMessage(locale, messages[locale as Locale])
    }
    i18n.global.fallbackLocale = displaySettings.locale.fallback
    // @ts-ignore
    document.title = i18n.global.t('headlines.title') + ' ' + i18n.global.t('headlines.emoji')
  }

  private withProgress<T>(promise: Promise<T>): Promise<T> {
    return promise.then((result) => {
      this.progress.value += this.progressIncrement
      return result
    })
  }
}

export default new APP_LOADER()
