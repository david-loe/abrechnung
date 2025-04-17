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
  TravelSettings,
  User
} from '../../common/types'
import API from './api.js'
import { formatter } from './formatter'
import i18n from './i18n'
import { logger } from './logger'
import { vueform } from './main'

export class APP_DATA {
  currencies: Currency[]
  countries: CountrySimple[]
  user: User
  settings: Settings
  travelSettings: TravelSettings
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
    travelSettings: TravelSettings,
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
    this.travelSettings = travelSettings
    this.displaySettings = displaySettings
    this.healthInsurances = healthInsurances
    this.organisations = organisations
    this.specialLumpSums = specialLumpSums

    this.projects = projects
    this.users = users
  }
}

class APP_LOADER {
  data: Ref<APP_DATA | null> = ref(null)
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
            this.withProgress(API.getter<TravelSettings>('travelSettings')),
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
              travelSettingsRes,
              healthInsurancesRes,
              organisationsRes,
              specialLumpSumsRes,
              displaySettingsRes
            ] = result[0].value

            let projectsRes = undefined
            let usersRes = undefined
            if (result[1].status === 'fulfilled') {
              projectsRes = result[1].value[0].status === 'fulfilled' ? result[1].value[0].value : undefined
              usersRes = result[1].value[1].status === 'fulfilled' ? result[1].value[1].value : undefined
            }
            if (
              userRes.ok &&
              currenciesRes.ok &&
              countriesRes.ok &&
              settingsRes.ok &&
              travelSettingsRes.ok &&
              healthInsurancesRes.ok &&
              organisationsRes.ok &&
              specialLumpSumsRes.ok &&
              displaySettingsRes.ok
            ) {
              const data = new APP_DATA(
                currenciesRes.ok.data,
                countriesRes.ok.data,
                userRes.ok.data,
                settingsRes.ok.data,
                travelSettingsRes.ok.data,
                displaySettingsRes.ok.data,
                healthInsurancesRes.ok.data,
                organisationsRes.ok.data,
                specialLumpSumsRes.ok.data,
                projectsRes?.ok?.data,
                usersRes?.ok?.data
              )
              resolve(data)
              this.data.value = data
              this.updateLocales(displaySettingsRes.ok.data)
              this.setLanguage(data.user.settings.language)
              this.state.value = 'LOADED'
              logger.info(`${i18n.global.t('labels.user')}:`)
              logger.info(userRes.ok.data)
            } else {
              reject('Error loading essential data')
            }
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
    ;(i18n.global.fallbackLocale as unknown as Ref<Locale>).value = displaySettings.locale.fallback
    //@ts-ignore
    document.title = `${i18n.global.t('headlines.title')} ${i18n.global.t('headlines.emoji')}`
  }

  setLanguage(locale: Locale) {
    ;(i18n.global.locale as unknown as Ref<Locale>).value = locale
    vueform.i18n.locale = locale
    formatter.setLocale(locale)
  }

  private withProgress<T>(promise: Promise<T>): Promise<T> {
    return promise.then((result) => {
      this.progress.value += this.progressIncrement
      return result
    })
  }
}

export default new APP_LOADER()
