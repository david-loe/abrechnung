import { emailRegex, Organisation } from 'abrechnung-common/types.js'
import { model, mongo, Query, Schema, Types } from 'mongoose'
import { populateSelected } from './helper.js'

export const organisationSchema = () =>
  new Schema<Organisation<Types.ObjectId, mongo.Binary>>({
    name: { type: String, trim: true, required: true },
    reportEmail: { type: String, validate: emailRegex },
    a1CertificateEmail: { type: String, validate: emailRegex },
    website: { type: String },
    bankDetails: { type: String, multiline: true },
    companyNumber: { type: String, trim: true },
    logo: { type: Schema.Types.ObjectId, ref: 'DocumentFile' },
    subfolderPath: { type: String, trim: true, default: '' }
  })

const schema = organisationSchema()

const populates = { logo: [{ path: 'logo', select: { name: 1, type: 1 } }] }

schema.pre(
  /^find((?!Update).)*$/,
  async function (this: Query<Organisation<Types.ObjectId, mongo.Binary>, Organisation<Types.ObjectId, mongo.Binary>>) {
    await populateSelected(this, populates)
  }
)

export default model<Organisation<Types.ObjectId, mongo.Binary>>('Organisation', schema)
