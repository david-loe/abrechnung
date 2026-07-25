import { ReportModelName, reportModelNames } from 'abrechnung-common/types.js'
import { model, Schema } from 'mongoose'

interface ReferenceCounter {
  _id: ReportModelName
  value: number
}

const schema = new Schema<ReferenceCounter>(
  { _id: { type: String, enum: reportModelNames, required: true }, value: { type: Number, min: 0, required: true } },
  { versionKey: false }
)

const ReferenceCounterModel = model('ReferenceCounter', schema)

export async function nextReference(modelName: ReportModelName) {
  const counter = await ReferenceCounterModel.findOneAndUpdate(
    { _id: modelName },
    { $inc: { value: 1 } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  ).lean()

  if (!counter) {
    throw new Error(`Unable to allocate reference for ${modelName}`)
  }
  return counter.value
}

export default ReferenceCounterModel
