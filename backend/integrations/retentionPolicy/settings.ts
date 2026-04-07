import { RetentionType, retention } from 'abrechnung-common/types.js'

export function retentionPolicySchemaDefinition() {
  const retentionPolicy = {} as {
    [key in RetentionType]: {
      type: NumberConstructor
      min: number
      required: true
      validate: { validator: (value: number) => boolean; message: string }
      description: string
    }
  }

  for (const policy of retention) {
    retentionPolicy[policy] = {
      type: Number,
      min: 0,
      required: true,
      validate: { validator: Number.isInteger, message: 'Must be Integer' },
      description: `description.${policy}`
    }
  }

  return retentionPolicy
}
