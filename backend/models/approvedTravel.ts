import { model, Query, Schema } from 'mongoose'
import { ApprovedTravel } from '../../common/types.js'
import { populateSelected } from './helper.js'
import { travelBaseSchema } from './travel.js'

const approvedTravelSchema = () =>
  new Schema<ApprovedTravel>(
    Object.assign(travelBaseSchema, {
      traveler: { type: String, required: true },
      approvedBy: { type: String, required: true },
      appliedForOn: { type: Date, required: true },
      approvedOn: { type: Date, required: true },
      reportId: { type: Schema.Types.ObjectId, ref: 'Travel', required: true }
    }),
    { timestamps: true }
  )

const schema = approvedTravelSchema()

const populates = {
  destinationPlace: [{ path: 'destinationPlace.country', select: { name: 1, flag: 1, currency: 1, needsA1Certificate: 1 } }]
}

schema.pre(/^find((?!Update).)*$/, async function (this: Query<ApprovedTravel, ApprovedTravel>) {
  await populateSelected(this, populates)
})

export default model<ApprovedTravel>('Travel', schema)
