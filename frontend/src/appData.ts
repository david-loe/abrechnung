import { Ref, ref } from 'vue'
import { loadLocales } from '../../common/locales/load'
import { getById } from '../../common/scripts'
import { TravelCalculator } from '../../common/travel'
import {
  Category,
  Country,
  CountryCode,
  Currency,
  DisplaySettings,
  HealthInsurance,
  Locale,
  OrganisationSimple,
  ProjectSimpleWithName,
  Settings,
  TravelSettings,
  User,
  UserWithNameAndProject
} from '../../common/types'
import API from './api.js'
import { formatter } from './formatter'
import i18n from './i18n'
import { logger } from './logger'
import { vueform } from './main'

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
type APP_DATA_OPTIONAL_ENDPOINTS = 'project' | 'users'
type APP_DATA_ENDPOINTS = APP_DATA_REQUIRED_ENDPOINTS | APP_DATA_OPTIONAL_ENDPOINTS

export class APP_DATA {
  user!: User
  currencies!: Currency[]
  countries!: Country[]
  settings!: Settings
  travelSettings!: TravelSettings
  displaySettings!: DisplaySettings
  healthInsurances!: HealthInsurance[]
  organisations!: OrganisationSimple[]
  categories!: Category[]
  defaultCategory: Category | undefined
  specialLumpSums!: Record<string, string[]>

  projects?: ProjectSimpleWithName[]
  users?: UserWithNameAndProject[]

  travelCalculator!: TravelCalculator

  constructor(
    currencies: Currency[],
    countries: Country[],
    user: User,
    settings: Settings,
    travelSettings: TravelSettings,
    displaySettings: DisplaySettings,
    healthInsurances: HealthInsurance[],
    organisations: OrganisationSimple[],
    categories: Category[],

    specialLumpSums: Record<string, string[]>,
    projects?: ProjectSimpleWithName[],
    users?: UserWithNameAndProject[]
  ) {
    this.setUser(user)
    this.setCurrencies(currencies)
    this.setCountries(countries)
    this.setSettings(settings)
    this.setTravelSettings(travelSettings) // needs countries to be set first
    this.setDisplaySettings(displaySettings)
    this.setHealthInsurances(healthInsurances)
    this.setOrganisations(organisations)
    this.setCategories(categories)
    this.setSpecialLumpSums(specialLumpSums)

    this.setProjects(projects)
    this.setUsers(users)
  }

  setAny(endpoint: APP_DATA_ENDPOINTS, data: unknown) {
    switch (endpoint) {
      case 'currency':
        this.setCurrencies(data as Currency[])
        break
      case 'country':
        this.setCountries(data as Country[])
        break
      case 'user':
        this.setUser(data as User)
        break
      case 'settings':
        this.setSettings(data as Settings)
        break
      case 'travelSettings':
        this.setTravelSettings(data as TravelSettings)
        break
      case 'healthInsurance':
        this.setHealthInsurances(data as HealthInsurance[])
        break
      case 'organisation':
        this.setOrganisations(data as OrganisationSimple[])
        break
      case 'category':
        this.setCategories(data as Category[])
        break
      case 'specialLumpSums':
        this.setSpecialLumpSums(data as Record<string, string[]>)
        break
      case 'displaySettings':
        this.setDisplaySettings(data as DisplaySettings)
        break
      case 'project':
        this.setProjects(data as ProjectSimpleWithName[])
        break
      case 'users':
        this.setUsers(data as UserWithNameAndProject[])
        break
    }
  }
  setCurrencies(currencies: Currency[]) {
    this.currencies = currencies
  }
  setCountries(countries: Country[]) {
    this.countries = countries
  }
  setUser(user: User) {
    this.user = user
    if (this.user.settings.hasUserSetLanguage) {
      setLanguage(this.user.settings.language)
    }
    //@ts-ignore
    logger.info(`${i18n.global.t('labels.user')}:`)
    logger.info(user)
  }
  setSettings(settings: Settings) {
    this.settings = settings
  }
  setTravelSettings(travelSettings: TravelSettings) {
    this.travelSettings = travelSettings
    if (this.travelCalculator) {
      this.travelCalculator.updateSettings(travelSettings)
    } else {
      this.travelCalculator = new TravelCalculator(async (code: CountryCode) => {
        const country = getById(code, this.countries)
        if (!country) {
          throw new Error(`No Country found for code ${code}`)
        }
        return country
      }, this.travelSettings)
    }
  }
  setDisplaySettings(displaySettings: DisplaySettings) {
    this.displaySettings = displaySettings
    formatter.setNameDisplayFormat(displaySettings.nameDisplayFormat)
    updateLocales(displaySettings)
  }
  setHealthInsurances(healthInsurances: HealthInsurance[]) {
    this.healthInsurances = healthInsurances
  }
  setOrganisations(organisations: OrganisationSimple[]) {
    this.organisations = organisations
  }
  setCategories(categories: Category[]) {
    this.categories = categories
    this.defaultCategory = categories.length === 1 ? categories[0] : categories.find((category) => category.isDefault)
  }
  setSpecialLumpSums(specialLumpSums: Record<string, string[]>) {
    this.specialLumpSums = specialLumpSums
  }
  setProjects(projects?: ProjectSimpleWithName[]) {
    if (projects) {
      this.projects = projects
    }
  }
  setUsers(users?: UserWithNameAndProject[]) {
    if (users) {
      this.users = users
    }
  }
}

class APP_LOADER {
  data: Ref<APP_DATA | null> = ref(null)
  dataPromise?: Promise<APP_DATA>
  displaySettingsPromise?: Promise<DisplaySettings>
  state: Ref<'UNLOADED' | 'LOADING' | 'LOADED'> = ref('UNLOADED')
  progress = ref(0)
  progressIncrement = 10 // 10 * 10 = 100

  async loadRequired<T>(endpoint: APP_DATA_REQUIRED_ENDPOINTS) {
    const res = await API.getter<T>(endpoint)
    if (!res.ok) {
      throw new Error(`Failed to load ${endpoint} data`)
    }
    if (this.data.value) {
      this.data.value.setAny(endpoint, res.ok.data)
    }
    return res.ok.data
  }

  async loadOptional<T>(endpoint: APP_DATA_OPTIONAL_ENDPOINTS) {
    const res = await API.getter<T>(endpoint, {}, {}, false)
    if (res.ok) {
      if (this.data.value) {
        this.data.value.setAny(endpoint, res.ok.data)
      }
      return res.ok.data
    }
    return undefined
  }

  loadData(reload = false) {
    if (this.dataPromise === undefined || reload) {
      this.state.value = 'LOADING'
      this.progress.value = 0
      this.dataPromise = new Promise((resolve, reject) => {
        Promise.allSettled([
          Promise.all([
            this.withProgress(this.loadRequired<User>('user')),
            this.withProgress(this.loadRequired<Currency[]>('currency')),
            this.withProgress(this.loadRequired<Country[]>('country')),
            this.withProgress(this.loadRequired<Settings>('settings')),
            this.withProgress(this.loadRequired<TravelSettings>('travelSettings')),
            this.withProgress(this.loadRequired<HealthInsurance[]>('healthInsurance')),
            this.withProgress(this.loadRequired<OrganisationSimple[]>('organisation')),
            this.withProgress(this.loadRequired<Category[]>('category')),
            this.withProgress(this.loadRequired<Record<string, string[]>>('specialLumpSums')),
            this.withProgress(this.loadRequired<DisplaySettings>('displaySettings'))
          ]),
          Promise.allSettled([
            this.withProgress(this.loadOptional<ProjectSimpleWithName[]>('project')),
            this.withProgress(this.loadOptional<UserWithNameAndProject[]>('users'))
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
              displaySettings
            ] = result[0].value

            let projects: ProjectSimpleWithName[] | undefined
            let users: UserWithNameAndProject[] | undefined
            if (result[1].status === 'fulfilled') {
              projects = result[1].value[0].status === 'fulfilled' ? result[1].value[0].value : undefined
              users = result[1].value[1].status === 'fulfilled' ? result[1].value[1].value : undefined
            }

            const data = new APP_DATA(
              currencies,
              countries,
              user,
              settings,
              travelSettings,
              displaySettings,
              healthInsurances,
              organisations,
              categories,
              specialLumpSums,
              projects,
              users
            )
            resolve(data)
            this.data.value = data
            this.state.value = 'LOADED'
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
            updateLocales(result.ok.data)
          } else {
            reject(result.error)
          }
        })
      })
    }
    return this.displaySettingsPromise
  }

  private withProgress<T>(promise: Promise<T>): Promise<T> {
    return promise.then((result) => {
      this.progress.value += this.progressIncrement
      return result
    })
  }
}

function updateLocales(displaySettings: DisplaySettings) {
  const messages = loadLocales(displaySettings.locale.overwrite)
  for (const locale in messages) {
    i18n.global.setLocaleMessage(locale, messages[locale as Locale])
  }
  ;(i18n.global.fallbackLocale as unknown as Ref<Locale>).value = displaySettings.locale.fallback
  //@ts-ignore
  document.title = `${i18n.global.t('headlines.title')} ${i18n.global.t('headlines.emoji')}`
}

function setLanguage(locale: Locale) {
  ;(i18n.global.locale as unknown as Ref<Locale>).value = locale
  vueform.i18n.locale = locale
  formatter.setLocale(locale)
}

export default new APP_LOADER()
