import mongoose, { HydratedDocument, InferSchemaType, Model, Schema, model } from 'mongoose'
import { addUp } from '../../common/scripts.js'
import { ExpenseReport, HealthCareCost, Project, Travel, _id } from '../../common/types.js'
import { costObject } from '../helper.js'

interface Methods {
  updateBalance(): Promise<void>
}

type ProjectModel = Model<Project, {}, Methods>

const projectSchema = new Schema<Project, ProjectModel, Methods>({
  identifier: { type: String, trim: true, required: true, unique: true, index: true },
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  name: { type: String, trim: true },
  balance: costObject(false, false, true, null, 0),
  budget: costObject(false, false, false)
})

projectSchema.methods.updateBalance = async function (this: ProjectDoc): Promise<void> {
  let sum = 0
  const travels = mongoose.connection.collection('travels').find({ project: this._id, state: 'refunded', historic: false })
  const expenseReports = mongoose.connection.collection('expensereports').find({ project: this._id, state: 'refunded', historic: false })
  const healthCareCosts = mongoose.connection.collection('healthcarecosts').find({ project: this._id, state: 'refunded', historic: false })
  for await (const travel of travels) {
    const addedUp = addUp(travel as Travel)
    if (addedUp.expenses.amount) {
      sum += addedUp.expenses.amount
    }
    if (addedUp.lumpSums.amount) {
      sum += addedUp.lumpSums.amount
    }
  }
  for await (const expenseReport of expenseReports) {
    const addedUp = addUp(expenseReport as ExpenseReport)
    if (addedUp.expenses.amount) {
      sum += addedUp.expenses.amount
    }
  }
  for await (const healthCareCost of healthCareCosts) {
    const addedUp = addUp(healthCareCost as HealthCareCost)
    if (addedUp.expenses.amount) {
      sum += addedUp.expenses.amount
    }
  }
  this.balance = { amount: sum }
  await this.save()
}

export type ProjectSchema = InferSchemaType<typeof projectSchema>
export type IProject = ProjectSchema & { _id: _id }

export default model<Project, ProjectModel>('Project', projectSchema)

export interface ProjectDoc extends Methods, HydratedDocument<Project> {}
