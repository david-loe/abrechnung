import { ConnectionSettings, DisplaySettings, PrinterSettings, Settings, TravelSettings } from 'abrechnung-common/types.js'
import { getConnectionSettings, getDisplaySettings, getPrinterSettings, getSettings, getTravelSettings } from '../db.js'

export class CACHE {
  #settings: Settings
  #connectionSettings: ConnectionSettings
  #displaySettings: DisplaySettings
  #printerSettings: PrinterSettings
  #travelSettings: TravelSettings

  constructor(
    settings: Settings,
    connectionSettings: ConnectionSettings,
    displaySettings: DisplaySettings,
    printerSettings: PrinterSettings,
    travelSettings: TravelSettings
  ) {
    this.#settings = settings
    this.#connectionSettings = connectionSettings
    this.#displaySettings = displaySettings
    this.#printerSettings = printerSettings
    this.#travelSettings = travelSettings
  }

  async reload() {
    this.#settings = await getSettings(false)
    this.#connectionSettings = await getConnectionSettings(false)
    this.#displaySettings = await getDisplaySettings(false)
    this.#printerSettings = await getPrinterSettings(false)
    this.#travelSettings = await getTravelSettings(false)
  }

  static async create(init = true) {
    return new CACHE(
      await getSettings(init),
      await getConnectionSettings(init),
      await getDisplaySettings(init),
      await getPrinterSettings(init),
      await getTravelSettings(init)
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
