import mongoose, { HydratedDocument, InferSchemaType, Model, Schema, model } from 'mongoose'
import { ExpenseReport, HealthCareCost, Project, ProjectUsers, Travel, _id } from '../../common/types.js'
import { costObject } from './helper.js'

interface Methods {
  updateBalance(): Promise<void>
}

type ProjectModel = Model<Project, {}, Methods>

export const projectSchema = () =>
  new Schema<Project, ProjectModel, Methods>({
    identifier: { type: String, trim: true, required: true, unique: true, index: true },
    organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
    name: { type: String, trim: true },
    budget: Object.assign({ description: 'in EUR' }, costObject(false, false, false)),
    balance: Object.assign({ description: 'in EUR' }, costObject(false, false, true, null, 0))
  })

const schema = projectSchema()

schema.methods.updateBalance = async function (this: ProjectDoc): Promise<void> {
  let sum = 0
  const travels = mongoose.connection.collection('travels').find({ project: this._id, state: 'refunded', historic: false })
  const expenseReports = mongoose.connection.collection('expensereports').find({ project: this._id, state: 'refunded', historic: false })
  const healthCareCosts = mongoose.connection.collection('healthcarecosts').find({ project: this._id, state: 'refunded', historic: false })
  for await (const travel of travels) {
    if ((travel as Travel).addUp.total.amount) {
      sum += (travel as Travel).addUp.total.amount!
    }
  }
  for await (const expenseReport of expenseReports) {
    if ((expenseReport as ExpenseReport).addUp.total.amount) {
      sum += (expenseReport as ExpenseReport).addUp.total.amount!
    }
  }
  for await (const healthCareCost of healthCareCosts) {
    if ((healthCareCost as HealthCareCost).addUp.total.amount) {
      sum += (healthCareCost as HealthCareCost).addUp.total.amount!
    }
  }
  this.balance = { amount: sum }
  await this.save()
}

export type ProjectSchema = InferSchemaType<typeof schema>
export type IProject = ProjectSchema & { _id: _id }

export default model<Project, ProjectModel>('Project', schema)

export interface ProjectDoc extends Methods, HydratedDocument<Project> {}

export const projectUsersSchema = new Schema<ProjectUsers>({
  assignees: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], required: true, label: 'labels.addAssignees' },
  supervisors: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], required: true, label: 'labels.addSupervisors' }
})
