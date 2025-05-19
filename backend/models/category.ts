import { Document, Schema, model } from 'mongoose'
import { Category } from '../../common/types.js'
import { colorSchema } from './helper.js'

export const categorySchema = () =>
  new Schema<Category>({
    name: { type: String, trim: true, required: true },
    isDefault: { type: Boolean, default: false },
    style: colorSchema()
  })

const schema = categorySchema()

schema.pre('deleteOne', { document: true, query: false }, function (this: Document<Category>) {})

export default model<Category>('Category', schema)
