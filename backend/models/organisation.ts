import { emailRegex, Organisation, TravelExpenseItem, travelExpenseItems } from 'abrechnung-common/types.js'
import { model, mongo, Query, Schema, Types } from 'mongoose'
import { populateSelected } from './helper.js'

export const organisationSchema = () => {
  const accountMapping = {} as { [key in TravelExpenseItem]: { type: typeof Schema.Types.ObjectId; required: true; ref: 'LedgerAccount' } }
  for (const item of travelExpenseItems) {
    accountMapping[item] = { type: Schema.Types.ObjectId, required: true, ref: 'LedgerAccount' }
  }

  return new Schema<Organisation<Types.ObjectId, mongo.Binary>>({
    name: { type: String, trim: true, required: true },
    reportEmail: { type: String, validate: emailRegex },
    a1CertificateEmail: { type: String, validate: emailRegex },
    accountingSettings: {
      type: {
        employeeLiabilitiesAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
        employeeClaimsAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
        employeeSpecificTemplate: { type: String, trim: true },
        accountMapping: { type: accountMapping, required: true },
        vatAccountingEnabled: { type: Boolean, required: true, default: true },
        vatRates: {
          type: [
            {
              type: {
                rate: { type: Number, min: 0, max: 100, required: true },
                inputTaxAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount' }
              }
            }
          ],
          required: true,
          validate: {
            validator: (rates: { rate: number; inputTaxAccount?: Types.ObjectId }[]) =>
              rates.some(({ rate }) => rate === 0) &&
              new Set(rates.map(({ rate }) => rate)).size === rates.length &&
              rates.every(({ rate, inputTaxAccount }) => rate === 0 || Boolean(inputTaxAccount)),
            message: 'invalidVatRates'
          }
        }
      },
      required: true
    },
    website: { type: String },
    logo: { type: Schema.Types.ObjectId, ref: 'DocumentFile' },
    subfolderPath: { type: String, trim: true, default: '' },
    bankDetails: { type: String, multiline: true },
    companyNumber: { type: String, trim: true }
  })
}

const schema = organisationSchema()

const populates = { logo: [{ path: 'logo', select: { name: 1, type: 1 } }] }

schema.pre(
  /^find((?!Update).)*$/,
  async function (this: Query<Organisation<Types.ObjectId, mongo.Binary>, Organisation<Types.ObjectId, mongo.Binary>>) {
    await populateSelected(this, populates)
  }
)

export default model<Organisation<Types.ObjectId, mongo.Binary>>('Organisation', schema)
