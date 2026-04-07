import { Integration } from '../integration.js'
import { syncLumpSums } from './sync.js'

class LumpSumsIntegration extends Integration {
  public override readonly operations = {
    sync: {
      jobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
      run: async () => {
        await syncLumpSums()
      }
    }
  }

  public constructor() {
    super('lumpSums')
  }
}

export const lumpSumsIntegration = new LumpSumsIntegration()
