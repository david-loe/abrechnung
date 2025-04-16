import { Document, model, Query, Schema } from 'mongoose'
import { emailRegex, Organisation } from '../../common/types.js'

export const organisationSchema = () =>
  new Schema<Organisation>({
    name: { type: String, trim: true, required: true },
    reportEmail: { type: String, validate: emailRegex },
    a1CertificateEmail: { type: String, validate: emailRegex },
    website: { type: String },
    bankDetails: { type: String, multiline: true },
    companyNumber: { type: String, trim: true },
    logo: { type: Schema.Types.ObjectId, ref: 'DocumentFile' },
    subfolderPath: { type: String, trim: true, default: '' }
  })

function populate(doc: Document) {
  return Promise.allSettled([doc.populate({ path: 'logo', select: { name: 1, type: 1 } })])
}

const schema = organisationSchema()

schema.pre(/^find((?!Update).)*$/, function () {
  const projection = (this as Query<Organisation, Organisation>).projection()
  const popInProj: boolean = projection && projection.logo
  if ((this as Query<Organisation, Organisation>).selectedExclusively() && popInProj) {
    return
  }
  if ((this as Query<Organisation, Organisation>).selectedInclusively() && !popInProj) {
    return
  }
  populate(this as Document)
})

export default model<Organisation>('Organisation', schema)
