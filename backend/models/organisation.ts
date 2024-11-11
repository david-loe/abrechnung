import { Document, model, Query, Schema } from 'mongoose'
import { emailRegex, Organisation } from '../../common/types.js'

export const organisationSchema = new Schema<Organisation>({
  name: { type: String, trim: true, required: true },
  subfolderPath: { type: String, trim: true, default: '' },
  reportEmail: { type: String, validate: emailRegex },
  bankDetails: { type: String },
  companyNumber: { type: String, trim: true },
  logo: { type: Schema.Types.ObjectId, ref: 'DocumentFile' },
  website: { type: String }
})

function populate(doc: Document) {
  return Promise.allSettled([doc.populate({ path: 'logo', select: { name: 1, type: 1 } })])
}

organisationSchema.pre(/^find((?!Update).)*$/, function () {
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

export default model<Organisation>('Organisation', organisationSchema)
