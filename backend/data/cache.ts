import { ConnectionSettings, DisplaySettings, PrinterSettings, Settings, TravelSettings } from 'abrechnung-common/types.js'
import { RedisConnection } from 'bullmq'
import { updateI18n } from '../i18n.js'

export type CacheLoader<T> = (init?: boolean) => Promise<T>
export type CacheLoaders = {
  loadSettings: CacheLoader<Settings>
  loadConnectionSettings: CacheLoader<ConnectionSettings>
  loadDisplaySettings: CacheLoader<DisplaySettings>
  loadPrinterSettings: CacheLoader<PrinterSettings>
  loadTravelSettings: CacheLoader<TravelSettings>
}

export interface BackendConfigSnapshot {
  readonly settings: Settings
  readonly connectionSettings: ConnectionSettings
  readonly displaySettings: DisplaySettings
  readonly printerSettings: PrinterSettings
  readonly travelSettings: TravelSettings
}

type SnapshotListener = (snapshot: BackendConfigSnapshot) => void
type ReadinessListener = (ready: boolean) => void
type PubSubClient = {
  on(event: string, listener: (...args: never[]) => void): unknown
  subscribe(channel: string): Promise<unknown>
  publish(channel: string, message: string): Promise<unknown>
  set(key: string, value: string, expiryMode: 'EX', seconds: number): Promise<unknown>
}

const INVALIDATION_CHANNEL = 'backend-config:invalidate'

function deepFreeze<T>(value: T): T {
  if (ArrayBuffer.isView(value) || value instanceof Date) return value
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) {
      deepFreeze(child)
    }
  }
  return value
}

export class CACHE {
  #snapshot: BackendConfigSnapshot | undefined
  #loaders: CacheLoaders
  #listeners = new Set<SnapshotListener>()
  #readinessListeners = new Set<ReadinessListener>()
  #publisher: RedisConnection | undefined
  #subscriber: RedisConnection | undefined
  #reloadPromise: Promise<BackendConfigSnapshot> | undefined
  #subscriptionReady = false

  constructor(loaders: CacheLoaders) {
    this.#loaders = loaders
  }

  static async create(loaders: CacheLoaders, init = true) {
    const cache = new CACHE(loaders)
    await cache.initialize(init)
    return cache
  }

  get initialized() {
    return Boolean(this.#snapshot)
  }

  get synchronizationReady() {
    return this.#subscriptionReady
  }

  get ready() {
    return this.initialized && this.synchronizationReady
  }

  getSnapshot() {
    if (!this.#snapshot) {
      throw new Error('Backend configuration runtime has not been initialized')
    }
    return this.#snapshot
  }

  onSnapshot(listener: SnapshotListener) {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  onReadiness(listener: ReadinessListener) {
    this.#readinessListeners.add(listener)
    return () => this.#readinessListeners.delete(listener)
  }

  #setSubscriptionReady(ready: boolean) {
    if (this.#subscriptionReady === ready) return
    this.#subscriptionReady = ready
    for (const listener of this.#readinessListeners) listener(this.ready)
  }

  async initialize(init = false) {
    return await this.reload(init)
  }

  async reload(init = false) {
    if (!this.#reloadPromise) {
      this.#reloadPromise = this.#loadSnapshot(init).finally(() => {
        this.#reloadPromise = undefined
      })
    }
    return await this.#reloadPromise
  }

  async #loadSnapshot(init: boolean) {
    const [settings, connectionSettings, displaySettings, printerSettings, travelSettings] = await Promise.all([
      this.#loaders.loadSettings(init),
      this.#loaders.loadConnectionSettings(init),
      this.#loaders.loadDisplaySettings(init),
      this.#loaders.loadPrinterSettings(init),
      this.#loaders.loadTravelSettings(init)
    ])
    const snapshot = deepFreeze({ settings, connectionSettings, displaySettings, printerSettings, travelSettings })
    this.#snapshot = snapshot
    updateI18n(snapshot.displaySettings.locale)
    for (const listener of this.#listeners) {
      listener(snapshot)
    }
    return snapshot
  }

  async initializeSynchronization(redisUrl: string, redisPrefix: string) {
    if (this.#publisher || this.#subscriber) return

    this.#redisPrefix = redisPrefix
    const channel = `${redisPrefix}:${INVALIDATION_CHANNEL}`
    this.#publisher = new RedisConnection({ url: redisUrl })
    this.#subscriber = new RedisConnection({ url: redisUrl })
    const subscriber = (await this.#subscriber.client) as unknown as PubSubClient
    await this.#publisher.client
    subscriber.on('end', () => {
      this.#setSubscriptionReady(false)
    })
    subscriber.on('close', () => {
      this.#setSubscriptionReady(false)
    })
    subscriber.on('ready', () => {
      void this.reload(false)
        .then(() => {
          this.#setSubscriptionReady(true)
        })
        .catch(() => {
          this.#setSubscriptionReady(false)
        })
    })
    subscriber.on('message', (receivedChannel: string) => {
      if (receivedChannel === channel) {
        this.#setSubscriptionReady(false)
        void this.reload(false)
          .then(() => {
            this.#setSubscriptionReady(true)
          })
          .catch(() => {
            this.#setSubscriptionReady(false)
          })
      }
    })
    await subscriber.subscribe(channel)
    await this.reload(false)
    this.#setSubscriptionReady(true)
  }

  async refreshAndPublish() {
    const snapshot = await this.reload(false)
    if (this.#publisher) {
      const publisher = (await this.#publisher.client) as unknown as PubSubClient
      await publisher.publish(`${this.#redisPrefix}:${INVALIDATION_CHANNEL}`, String(Date.now()))
    }
    return snapshot
  }

  async publishWorkerHeartbeat() {
    if (!this.ready || !this.#publisher) return false
    const publisher = (await this.#publisher.client) as unknown as PubSubClient
    await publisher.set(`${this.#redisPrefix}:worker:heartbeat`, new Date().toISOString(), 'EX', 30)
    return true
  }

  #redisPrefix = ''

  async shutdown() {
    this.#setSubscriptionReady(false)
    await Promise.all([this.#subscriber?.close(), this.#publisher?.close()])
    this.#subscriber = undefined
    this.#publisher = undefined
  }

  get settings() {
    return this.getSnapshot().settings
  }

  get connectionSettings() {
    return this.getSnapshot().connectionSettings
  }

  get displaySettings() {
    return this.getSnapshot().displaySettings
  }

  get printerSettings() {
    return this.getSnapshot().printerSettings
  }

  get travelSettings() {
    return this.getSnapshot().travelSettings
  }
}
