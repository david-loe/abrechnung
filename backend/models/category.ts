import { model, Schema } from 'mongoose'
import { Category } from '../../common/types.js'
import { colorSchema } from './helper.js'

export const categorySchema = () =>
  new Schema<Category>({
    name: { type: String, trim: true, required: true, index: true },
    isDefault: { type: Boolean, default: false },
    style: colorSchema()
  })

const schema = categorySchema()

export default model<Category>('Category', schema)
