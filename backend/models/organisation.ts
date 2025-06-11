import { Query, Schema, model } from 'mongoose'
import { Organisation, TravelExpenseItem, emailRegex, travelExpenseItems } from '../../common/types.js'
import { populateSelected } from './helper.js'

export const organisationSchema = () => {
  const accountMapping = {} as { [key in TravelExpenseItem]: { type: typeof Schema.Types.ObjectId; required: true; ref: 'LedgerAccount' } }
  for (const item of travelExpenseItems) {
    accountMapping[item] = { type: Schema.Types.ObjectId, required: true, ref: 'LedgerAccount' }
  }

  return new Schema<Organisation>({
    name: { type: String, trim: true, required: true },
    reportEmail: { type: String, validate: emailRegex },
    a1CertificateEmail: { type: String, validate: emailRegex },
    accountingSettings: {
      type: {
        employeeLiabilitiesAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
        employeeClaimsAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
        employeeSpecificTemplate: { type: String, trim: true },
        accountMapping: { type: accountMapping, required: true }
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

const populates = {
  logo: [{ path: 'logo', select: { name: 1, type: 1 } }]
}

schema.pre(/^find((?!Update).)*$/, async function (this: Query<Organisation, Organisation>) {
  await populateSelected(this, populates)
})

export default model<Organisation>('Organisation', schema)
