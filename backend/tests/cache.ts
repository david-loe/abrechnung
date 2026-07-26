import displaySettings from 'abrechnung-common/data/displaySettings.js'
import printerSettings from 'abrechnung-common/print/printerSettings.js'
import travelSettings from 'abrechnung-common/travel/travelSettings.js'
import { ConnectionSettings, DisplaySettings, PrinterSettings, Settings, TravelSettings } from 'abrechnung-common/types.js'
import test from 'ava'
import { ObjectId } from 'mongodb'
import { CACHE } from '../data/cache.js'
import connectionSettings from '../data/connectionSettings.development.js'
import settings from '../data/settings.js'
import ENV from '../env.js'

function loaders(onSettingsLoad: () => void = () => undefined) {
  return {
    loadSettings: async () => {
      onSettingsLoad()
      return { ...structuredClone(settings), _id: new ObjectId() } as Settings
    },
    loadConnectionSettings: async () => structuredClone(connectionSettings) as unknown as ConnectionSettings,
    loadDisplaySettings: async () => structuredClone(displaySettings) as unknown as DisplaySettings,
    loadPrinterSettings: async () => structuredClone(printerSettings) as unknown as PrinterSettings,
    loadTravelSettings: async () => structuredClone(travelSettings) as unknown as TravelSettings
  }
}

test('configuration cache performs no work before explicit initialization', async (t) => {
  let settingsLoads = 0
  const cache = new CACHE(loaders(() => settingsLoads++))

  t.is(settingsLoads, 0)
  t.false(cache.initialized)
  t.throws(() => cache.getSnapshot(), { message: 'Backend configuration runtime has not been initialized' })

  const snapshot = await cache.initialize()
  t.is(settingsLoads, 1)
  t.true(cache.initialized)
  t.true(Object.isFrozen(snapshot))
  t.true(Object.isFrozen(snapshot.settings))
})

test('configuration cache atomically coalesces concurrent reloads', async (t) => {
  let settingsLoads = 0
  const cache = await CACHE.create(loaders(() => settingsLoads++))
  const initialSnapshot = cache.getSnapshot()

  const [first, second] = await Promise.all([cache.reload(), cache.reload()])

  t.is(settingsLoads, 2)
  t.is(first, second)
  t.not(first, initialSnapshot)
  t.is(cache.getSnapshot(), first)
})

test('configuration invalidation reloads another process cache through Redis', async (t) => {
  let currentVersion = 'cache-version-a'
  const synchronizedLoaders = () => ({
    ...loaders(),
    loadSettings: async () => ({ ...structuredClone(settings), version: currentVersion, _id: new ObjectId() }) as Settings
  })
  const first = new CACHE(synchronizedLoaders())
  const second = new CACHE(synchronizedLoaders())
  const prefix = `${ENV.REDIS_PREFIX}:cache-test:${new ObjectId()}`

  try {
    await Promise.all([first.initialize(), second.initialize()])
    await Promise.all([first.initializeSynchronization(ENV.REDIS_URL, prefix), second.initializeSynchronization(ENV.REDIS_URL, prefix)])
    currentVersion = 'cache-version-b'
    await first.refreshAndPublish()

    for (let attempt = 0; attempt < 100 && second.settings.version !== currentVersion; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    t.is(first.settings.version, currentVersion)
    t.is(second.settings.version, currentVersion)
  } finally {
    await Promise.all([first.shutdown(), second.shutdown()])
  }
})
