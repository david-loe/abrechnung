import { InferSchemaType, Schema, model } from 'mongoose'
import { Project, _id } from '../../common/types.js'

const projectSchema = new Schema<Project>({
  name: { type: String, required: true, trim: true },
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
  balance: { type: Number }
})

export type ProjectSchema = InferSchemaType<typeof projectSchema>
export type IProject = ProjectSchema & { _id: _id }

export default model('Project', projectSchema)
