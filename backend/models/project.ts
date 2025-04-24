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
    balance: Object.assign({ description: 'in EUR' }, costObject(false, false, true))
  })

const schema = projectSchema()

schema.methods.updateBalance = async function (this: ProjectDoc): Promise<void> {
  let sum = 0
  const filter: mongoose.mongo.Filter<any> = { project: this._id, state: 'refunded', historic: false }
  const travels = mongoose.connection.collection<Travel>('travels').find(filter)
  const expenseReports = mongoose.connection.collection<ExpenseReport>('expensereports').find(filter)
  const healthCareCosts = mongoose.connection.collection<HealthCareCost>('healthcarecosts').find(filter)
  for await (const travel of travels) {
    if (travel.addUp.total.amount) {
      sum += travel.addUp.total.amount
    }
  }
  for await (const expenseReport of expenseReports) {
    if (expenseReport.addUp.total.amount) {
      sum += expenseReport.addUp.total.amount
    }
  }
  for await (const healthCareCost of healthCareCosts) {
    if (healthCareCost.addUp.total.amount) {
      sum += healthCareCost.addUp.total.amount
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
