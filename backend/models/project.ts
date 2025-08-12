import mongoose, { HydratedDocument, InferSchemaType, Model, model, Schema, Types } from 'mongoose'
import { _id, Project, ProjectSimple, ProjectUsers } from '../../common/types.js'
import { costObject } from './helper.js'

interface Methods {
  addToBalance(reportTotal: number, session?: mongoose.ClientSession | null): Promise<void>
}

// biome-ignore lint/complexity/noBannedTypes: mongoose uses {} as type
type ProjectModel = Model<Project<Types.ObjectId>, {}, Methods>

export const projectSchema = () =>
  new Schema<Project<Types.ObjectId>, ProjectModel, Methods>({
    identifier: { type: String, trim: true, required: true, unique: true, index: true },
    organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
    name: { type: String, trim: true },
    budget: Object.assign({ description: 'in EUR' }, costObject(false, false, false)),
    balance: Object.assign({ description: 'in EUR' }, costObject(false, false, true))
  })

const schema = projectSchema()

// When calling this method from populated paths, only the populated field are in the document
interface ProjectSimpleDoc extends Methods, HydratedDocument<ProjectSimple> {}

schema.methods.addToBalance = async function (this: ProjectSimpleDoc, reportTotal: number, session: mongoose.ClientSession | null = null) {
  if (reportTotal <= 0) {
    return
  }
  const doc = await model<Project<Types.ObjectId>, ProjectModel>('Project').findOne({ _id: this._id }).session(session)
  if (!doc) {
    return
  }
  doc.balance.amount += reportTotal
  await doc.save({ session })
}

export type ProjectSchema = InferSchemaType<typeof schema>
export type IProject = ProjectSchema & { _id: _id }

export default model<Project<Types.ObjectId>, ProjectModel>('Project', schema)

export interface ProjectDoc extends Methods, HydratedDocument<Project<Types.ObjectId>> {}

export const projectUsersSchema = new Schema<ProjectUsers<Types.ObjectId>>({
  assignees: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], required: true, label: 'labels.addAssignees' },
  supervisors: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], required: true, label: 'labels.addSupervisors' }
})
