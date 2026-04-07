import { Integration } from '../integration.js'
import { retentionPolicySchemaDefinition } from './settings.js'

class RetentionPolicyIntegration extends Integration {
  public override readonly operations = {
    apply: {
      run: async () => {
        const { applyRetentionPolicy } = await import('../../retentionpolicy.js')
        await applyRetentionPolicy()
      }
    }
  }

  public constructor() {
    super('retentionPolicy')
  }

  public override getSettingsFormSchema() {
    return retentionPolicySchemaDefinition()
  }
}

export const retentionPolicyIntegration = new RetentionPolicyIntegration()
