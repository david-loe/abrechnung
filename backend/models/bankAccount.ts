import { BankAccount } from 'abrechnung-common/types.js'
import { isValidBic, isValidIban, normalizeBic, normalizeIban } from 'abrechnung-common/utils/bank.js'
import { SchemaDefinition } from 'mongoose'

export const bankAccountSchema = {
  accountHolder: { type: String, trim: true, required: true },
  iban: { type: String, required: true, set: normalizeIban, validate: { validator: isValidIban, message: 'invalidIban' } },
  bic: {
    type: String,
    set: (value?: string | null) => (value ? normalizeBic(value) : undefined),
    validate: { validator: (value?: string | null) => !value || isValidBic(value), message: 'invalidBic' }
  }
} satisfies SchemaDefinition<BankAccount>
