import { loadLocales } from 'abrechnung-common/locales/load.js'
import { TravelCalculator } from 'abrechnung-common/travel/calculator.js'
import {
  Category,
  Country,
  CountryCode,
  CountrySimple,
  Currency,
  DisplaySettings,
  HealthInsurance,
  Locale,
  OrganisationSimple,
  PrinterSettings,
  Project,
  ProjectSimpleWithName,
  Settings,
  TravelSettings,
  User,
  UserSimpleWithProject
} from 'abrechnung-common/types.js'
import Formatter from 'abrechnung-common/utils/formatter.js'
import { getById } from 'abrechnung-common/utils/scripts.js'
import { isRef } from 'vue'
import { Composer } from 'vue-i18n'
import { getLanguageFromNavigator } from './i18n.js'

export class LOGIN_APP_DATA {
  private _displaySettings!: DisplaySettings<string>
  private _language!: Locale
  i18n: Composer<{}, {}, {}, Locale>
  formatter: Formatter
  private _languageChangeCB: (locale: Locale) => void

  constructor(
    displaySettings: DisplaySettings<string>,
    i18n: Composer<{}, {}, {}, Locale>,
    formatter: Formatter,
    languageChangeCB: (locale: Locale) => void
  ) {
    this._languageChangeCB = languageChangeCB
    this.i18n = i18n
    this.formatter = formatter
    this.language = getLanguageFromNavigator()
    this.displaySettings = displaySettings
  }
  get displaySettings() {
    return this._displaySettings
  }
  set displaySettings(displaySettings: DisplaySettings<string>) {
    this._displaySettings = displaySettings
    this.formatter.setNameDisplayFormat(displaySettings.nameDisplayFormat)
    this.updateLocales(displaySettings)
  }

  get language() {
    return this._language
  }
  set language(locale: Locale) {
    this._language = locale

    // fix wired change in composer structure - sometimes Ref and sometimes not
    if (isRef(this.i18n.locale)) {
      this.i18n.locale.value = locale
    } else {
      ;(this.i18n.locale as Locale) = locale
    }

    this.formatter.setLocale(locale)
    this._languageChangeCB(locale)
  }
  updateLocales(displaySettings: DisplaySettings) {
    const messages = loadLocales(displaySettings.locale.overwrite)
    for (const locale in messages) {
      this.i18n.setLocaleMessage(locale, messages[locale as Locale])
    }
    this.i18n.fallbackLocale.value = displaySettings.locale.fallback
    document.title = `${this.i18n.t('headlines.title')} ${this.i18n.t('headlines.emoji')}`
  }
}

export class TRAVEL_APP_DATA extends LOGIN_APP_DATA {
  currencies: Currency[]
  countries: Country[]
  settings: { version: string; uploadTokenExpireAfterSeconds: number }
  printerSettings: PrinterSettings<string>
  private _travelSettings!: TravelSettings<string>
  private _categories!: Category<string>[]
  specialLumpSums!: Record<string, string[]>

  organisations = [] as OrganisationSimple<string>[]
  projects?: ProjectSimpleWithName<string>[]

  private _userSimple = {
    _id: '',
    projects: { assigned: [] as Project<string>[] },
    settings: { lastCurrencies: [] as Currency[], lastCountries: [] as CountrySimple[] }
  }

  defaultCategory: Category<string> | undefined
  travelCalculator!: TravelCalculator

  constructor(
    data: {
      currencies: Currency[]
      countries: Country[]
      settings: { version: string; uploadTokenExpireAfterSeconds: number }
      travelSettings: TravelSettings<string>
      displaySettings: DisplaySettings<string>
      categories: Category<string>[]
      printerSettings: PrinterSettings<string>

      specialLumpSums: Record<string, string[]>
    },
    i18n: Composer<{}, {}, {}, Locale>,
    formatter: Formatter,
    languageChangeCB: (locale: Locale) => void
  ) {
    super(data.displaySettings, i18n, formatter, languageChangeCB)
    this.currencies = data.currencies
    this.countries = data.countries
    this.settings = data.settings
    this.travelSettings = data.travelSettings // needs countries to be set first
    this.categories = data.categories
    this.printerSettings = data.printerSettings // needs travelSettings to be set first
    this.specialLumpSums = data.specialLumpSums
  }

  get travelSettings() {
    return this._travelSettings
  }
  set travelSettings(travelSettings: TravelSettings<string>) {
    this._travelSettings = travelSettings
    if (this.travelCalculator) {
      this.travelCalculator.updateSettings(travelSettings)
    } else {
      this.travelCalculator = new TravelCalculator(async (code: CountryCode) => {
        const country = getById(code, this.countries)
        if (!country) {
          throw new Error(`No Country found for code ${code}`)
        }
        return country
      }, travelSettings)
    }
  }

  get categories() {
    return this._categories
  }
  set categories(categories: Category<string>[]) {
    this._categories = categories
    this.defaultCategory = categories.length === 1 ? categories[0] : categories.find((category) => category.isDefault)
  }

  get user() {
    return this._userSimple
  }
  set user(userSimple: typeof this._userSimple) {
    this._userSimple = userSimple
  }
}

export class APP_DATA extends TRAVEL_APP_DATA {
  private _user!: User<string>
  settings: Settings<string>
  healthInsurances: HealthInsurance<string>[]
  // organisations: OrganisationSimple<string>[]

  // projects?: ProjectSimpleWithName<string>[]
  users?: UserSimpleWithProject<string>[]

  constructor(
    data: {
      currencies: Currency[]
      countries: Country[]
      user: User<string>
      settings: Settings<string>
      travelSettings: TravelSettings<string>
      displaySettings: DisplaySettings<string>
      healthInsurances: HealthInsurance<string>[]
      organisations: OrganisationSimple<string>[]
      categories: Category<string>[]
      printerSettings: PrinterSettings<string>

      specialLumpSums: Record<string, string[]>
      projects?: ProjectSimpleWithName<string>[]
      users?: UserSimpleWithProject<string>[]
    },
    i18n: Composer<{}, {}, {}, Locale>,
    formatter: Formatter,
    languageChangeCB: (locale: Locale) => void
  ) {
    super(data, i18n, formatter, languageChangeCB)
    this.user = data.user
    this.settings = data.settings
    this.healthInsurances = data.healthInsurances
    this.organisations = data.organisations

    this.projects = data.projects
    this.users = data.users
  }

  get user() {
    return this._user
  }
  set user(user: User<string>) {
    this._user = user
    if (user.settings.hasUserSetLanguage) {
      this.language = user.settings.language
    }
  }
}
