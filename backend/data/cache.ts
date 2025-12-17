import { ConnectionSettings, DisplaySettings, PrinterSettings, Settings, TravelSettings } from 'abrechnung-common/types.js'

export type CacheLoader<T> = (init?: boolean) => Promise<T>
export type CacheLoaders = {
  loadSettings: CacheLoader<Settings>
  loadConnectionSettings: CacheLoader<ConnectionSettings>
  loadDisplaySettings: CacheLoader<DisplaySettings>
  loadPrinterSettings: CacheLoader<PrinterSettings>
  loadTravelSettings: CacheLoader<TravelSettings>
}

export class CACHE {
  #settings: Settings
  #connectionSettings: ConnectionSettings
  #displaySettings: DisplaySettings
  #printerSettings: PrinterSettings
  #travelSettings: TravelSettings
  #loaders: CacheLoaders

  constructor(
    loaders: CacheLoaders,
    settings: Settings,
    connectionSettings: ConnectionSettings,
    displaySettings: DisplaySettings,
    printerSettings: PrinterSettings,
    travelSettings: TravelSettings
  ) {
    this.#loaders = loaders
    this.#settings = settings
    this.#connectionSettings = connectionSettings
    this.#displaySettings = displaySettings
    this.#printerSettings = printerSettings
    this.#travelSettings = travelSettings
  }

  async reload() {
    this.#settings = await this.#loaders.loadSettings()
    this.#connectionSettings = await this.#loaders.loadConnectionSettings()
    this.#displaySettings = await this.#loaders.loadDisplaySettings()
    this.#printerSettings = await this.#loaders.loadPrinterSettings()
    this.#travelSettings = await this.#loaders.loadTravelSettings()
  }

  static async create(loaders: CacheLoaders, init = true) {
    return new CACHE(
      loaders,
      await loaders.loadSettings(init),
      await loaders.loadConnectionSettings(init),
      await loaders.loadDisplaySettings(init),
      await loaders.loadPrinterSettings(init),
      await loaders.loadTravelSettings(init)
    )
  }

  get settings() {
    return this.#settings
  }

  get connectionSettings() {
    return this.#connectionSettings
  }

  get displaySettings() {
    return this.#displaySettings
  }

  get printerSettings() {
    return this.#printerSettings
  }

  get travelSettings() {
    return this.#travelSettings
  }

  setSettings(settings: Settings) {
    this.#settings = settings
  }

  setConnectionSettings(connectionSettings: ConnectionSettings) {
    this.#connectionSettings = connectionSettings
  }

  setDisplaySettings(displaySettings: DisplaySettings) {
    this.#displaySettings = displaySettings
  }

  setPrinterSettings(printerSettings: PrinterSettings) {
    this.#printerSettings = printerSettings
  }

  setTravelSettings(travelSettings: TravelSettings) {
    this.#travelSettings = travelSettings
  }
}
