import { model, Schema, Types } from 'mongoose'
import { Category } from '../../common/types.js'
import { colorSchema } from './helper.js'

export const categorySchema = () =>
  new Schema<Category<Types.ObjectId>>({
    name: { type: String, trim: true, required: true, index: true },
    isDefault: { type: Boolean, default: false },
    style: colorSchema(undefined)
  })

const schema = categorySchema()

export default model<Category<Types.ObjectId>>('Category', schema)
