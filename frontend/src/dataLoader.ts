import {
  Category,
  Country,
  CountrySimple,
  Currency,
  DisplaySettings,
  HealthInsurance,
  Locale,
  OrganisationSimple,
  PrinterSettings,
  ProjectSimpleWithName,
  Settings,
  TravelSettings,
  User,
  UserSimpleWithProject
} from 'abrechnung-common/types.js'
import { Ref, ref } from 'vue'
import { LedgerAccount } from '../../common/types.js'
import API from './api.js'
import { app } from './app.js'
import { APP_DATA, LOGIN_APP_DATA } from './appData.js'
import { eventBus } from './eventBus.js'
import { formatter } from './formatter.js'
import i18n, { getLanguageFromNavigator } from './i18n.js'
import { logger } from './logger.js'

type APP_DATA_REQUIRED_ENDPOINTS =
  | 'user'
  | 'currency'
  | 'country'
  | 'settings'
  | 'travelSettings'
  | 'healthInsurance'
  | 'organisation'
  | 'category'
  | 'specialLumpSums'
  | 'displaySettings'
  | 'printerSettings'
type APP_DATA_OPTIONAL_ENDPOINTS = 'project' | 'users' | 'admin/ledgerAccount'
type APP_DATA_ENDPOINTS = APP_DATA_REQUIRED_ENDPOINTS | APP_DATA_OPTIONAL_ENDPOINTS

const languageChangeCB = (locale: Locale) => {
  if (app.config.globalProperties.$vueform) {
    app.config.globalProperties.$vueform.i18n.locale = locale
  }
}

class APP_LOADER {
  data: Ref<APP_DATA | null> = ref(null)
  dataPromise?: Promise<APP_DATA>
  loginData: Ref<LOGIN_APP_DATA | null> = ref(null)
  loginDataPromise?: Promise<LOGIN_APP_DATA>
  state: Ref<'UNLOADED' | 'LOADING' | 'LOADED'> = ref('UNLOADED')
  progress = ref(0)
  progressIncrement = 10 // 10 * 10 = 100

  constructor() {
    eventBus.addEventListener('lastCurrencies-updated', (e) =>
      API.setter('user/settings', { lastCurrencies: (e as CustomEvent).detail.map((c: Currency) => c._id) }, {}, false)
    )
    eventBus.addEventListener('lastCountries-updated', (e) =>
      API.setter('user/settings', { lastCountries: (e as CustomEvent).detail.map((c: CountrySimple) => c._id) }, {}, false)
    )
  }

  async loadRequired<T>(endpoint: APP_DATA_REQUIRED_ENDPOINTS) {
    const res = await API.getter<T>(endpoint)
    if (!res.ok) {
      throw new Error(`Failed to load ${endpoint} data`)
    }
    if (this.data.value) {
      setData(this.data.value, endpoint, res.ok.data)
    }
    return res.ok.data
  }

  async loadOptional<T>(endpoint: APP_DATA_OPTIONAL_ENDPOINTS) {
    const res = await API.getter<T>(endpoint, {}, {}, false)
    if (res.ok) {
      if (this.data.value) {
        setData(this.data.value, endpoint, res.ok.data)
      }
      return res.ok.data
    }
    return undefined
  }

  loadData(reload = false) {
    if (this.dataPromise === undefined || reload) {
      this.state.value = 'LOADING'
      this.progress.value = 0
      this.loginDataPromise = this.dataPromise = new Promise((resolve, reject) => {
        Promise.allSettled([
          Promise.all([
            this.withProgress(this.loadRequired<User<string>>('user')),
            this.withProgress(this.loadRequired<Currency[]>('currency')),
            this.withProgress(this.loadRequired<Country[]>('country')),
            this.withProgress(this.loadRequired<Settings<string>>('settings')),
            this.withProgress(this.loadRequired<TravelSettings<string>>('travelSettings')),
            this.withProgress(this.loadRequired<HealthInsurance<string>[]>('healthInsurance')),
            this.withProgress(this.loadRequired<OrganisationSimple<string>[]>('organisation')),
            this.withProgress(this.loadRequired<Category<string>[]>('category')),
            this.withProgress(this.loadRequired<Record<string, string[]>>('specialLumpSums')),
            this.withProgress(this.loadRequired<DisplaySettings<string>>('displaySettings')),
            this.withProgress(this.loadRequired<PrinterSettings<string>>('printerSettings'))
          ]),
          Promise.allSettled([
            this.withProgress(this.loadOptional<ProjectSimpleWithName<string>[]>('project')),
            this.withProgress(this.loadOptional<UserSimpleWithProject<string>[]>('users')),
            this.withProgress(this.loadOptional<LedgerAccount<string>[]>('admin/ledgerAccount'))
          ])
        ]).then((result) => {
          if (result[0].status === 'rejected') {
            reject(result[0].reason)
          } else {
            const [
              user,
              currencies,
              countries,
              settings,
              travelSettings,
              healthInsurances,
              organisations,
              categories,
              specialLumpSums,
              displaySettings,
              printerSettings
            ] = result[0].value

            let projects: ProjectSimpleWithName<string>[] | undefined
            let users: UserSimpleWithProject<string>[] | undefined
            let ledgerAccounts: LedgerAccount<string>[] | undefined
            if (result[1].status === 'fulfilled') {
              projects = result[1].value[0].status === 'fulfilled' ? result[1].value[0].value : undefined
              users = result[1].value[1].status === 'fulfilled' ? result[1].value[1].value : undefined
              ledgerAccounts = result[1].value[2].status === 'fulfilled' ? result[1].value[2].value : undefined
            }

            const data = new APP_DATA(
              {
                currencies,
                countries,
                user,
                settings,
                travelSettings,
                displaySettings,
                healthInsurances,
                organisations,
                categories,
                printerSettings,
                specialLumpSums,
                projects,
                users,
                ledgerAccounts
              },
              i18n.global,
              formatter,
              languageChangeCB
            )
            const navLang = getLanguageFromNavigator()
            if (!user.settings.hasUserSetLanguage && user.settings.language !== navLang) {
              API.setter('user/settings', { language: navLang } as Partial<User['settings']>, {}, false)
            }
            logger.info(`${i18n.global.t('labels.user')}:`)
            logger.info(user)
            resolve(data)
            this.data.value = data
            this.loginData.value = data
            this.state.value = 'LOADED'
          }
        })
      })
    }
    return this.dataPromise
  }

  loadLoginData(reload = false) {
    if (this.loginDataPromise === undefined || reload) {
      this.state.value = 'LOADING'
      this.loginDataPromise = new Promise((resolve, reject) => {
        API.getter<DisplaySettings<string>>('displaySettings').then((result) => {
          if (result.ok) {
            const loginData = new LOGIN_APP_DATA(result.ok.data, i18n.global, formatter, languageChangeCB)
            resolve(loginData)
            this.loginData.value = loginData
            this.state.value = 'LOADED'
          } else {
            reject(result.error)
          }
        })
      })
    }
    return this.loginDataPromise
  }

  private withProgress<T>(promise: Promise<T>): Promise<T> {
    return promise.then((result) => {
      this.progress.value += this.progressIncrement
      return result
    })
  }
}

function setData(appData: APP_DATA, endpoint: APP_DATA_ENDPOINTS, newData: unknown) {
  switch (endpoint) {
    case 'currency':
      appData.currencies = newData as Currency[]
      break
    case 'country':
      appData.countries = newData as Country[]
      break
    case 'user':
      appData.user = newData as User<string>
      break
    case 'settings':
      appData.settings = newData as Settings<string>
      break
    case 'travelSettings':
      appData.travelSettings = newData as TravelSettings<string>
      break
    case 'healthInsurance':
      appData.healthInsurances = newData as HealthInsurance<string>[]
      break
    case 'organisation':
      appData.organisations = newData as OrganisationSimple<string>[]
      break
    case 'category':
      appData.categories = newData as Category<string>[]
      break
    case 'specialLumpSums':
      appData.specialLumpSums = newData as Record<string, string[]>
      break
    case 'displaySettings':
      appData.displaySettings = newData as DisplaySettings<string>
      break
    case 'printerSettings':
      appData.printerSettings = newData as PrinterSettings<string>
      break
    case 'project':
      appData.projects = newData as ProjectSimpleWithName<string>[]
      break
    case 'users':
      appData.users = newData as UserSimpleWithProject<string>[]
      break
    case 'admin/ledgerAccount':
      appData.ledgerAccounts = newData as LedgerAccount<string>[]
      break
  }
}

export default new APP_LOADER()
