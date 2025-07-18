import { HydratedDocument, Model, model, Query, Schema } from 'mongoose'
import { ApprovedTravel, Travel, TravelState } from '../../common/types.js'
import { formatter } from '../factory.js'
import { populateSelected, travelBaseSchema } from './helper.js'

interface ApprovedTravelModelType extends Model<ApprovedTravel> {
  addOrUpdate(travel: Travel): Promise<HydratedDocument<ApprovedTravel>>
}

function convert(travel: Travel): ApprovedTravel {
  return {
    startDate: travel.startDate,
    endDate: travel.endDate,
    reason: travel.reason,
    destinationPlace: travel.destinationPlace,
    claimSpouseRefund: travel.claimSpouseRefund,
    fellowTravelersNames: travel.fellowTravelersNames,
    traveler: formatter.name(travel.owner.name),
    approvedBy: formatter.name(travel.log[TravelState.APPROVED]?.by.name),
    approvedOn: travel.log[TravelState.APPROVED]?.on as Date,
    appliedForOn: travel.log[TravelState.APPLIED_FOR]?.on || travel.createdAt,
    reportId: travel._id
  }
}

const approvedTravelSchema = () =>
  new Schema<ApprovedTravel, ApprovedTravelModelType>(
    Object.assign(travelBaseSchema(), {
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

schema.statics.addOrUpdate = async function (travel: Travel): Promise<HydratedDocument<ApprovedTravel>> {
  const alreadyExsists = await this.findOne({ reportId: travel._id })
  if (alreadyExsists) {
    alreadyExsists.set(convert(travel))
    await alreadyExsists.save()
    return alreadyExsists
  } else {
    const newOne = new this(convert(travel))
    await newOne.save()
    return newOne
  }
}

export default model<ApprovedTravel, ApprovedTravelModelType>('ApprovedTravel', schema)
