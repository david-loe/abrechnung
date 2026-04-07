import { Integration } from '../integration.js'

class LumpSumsIntegration extends Integration {
  public override readonly operations = {
    sync: {
      run: async () => {
        const { syncLumpSums } = await import('./sync.js')
        await syncLumpSums()
      }
    }
  }

  public constructor() {
    super('lumpSums')
  }
}

export const lumpSumsIntegration = new LumpSumsIntegration()
