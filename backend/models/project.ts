import mongoose, { HydratedDocument, InferSchemaType, Schema, model } from 'mongoose'
import { addUp } from '../../common/scripts.js'
import { BaseCurrencyMoney, ExpenseReport, HealthCareCost, Project, Travel, _id } from '../../common/types.js'
import { costObject } from '../helper.js'

interface Methods {
  calcBalance(): Promise<BaseCurrencyMoney>
}

const projectSchema = new Schema<Project>({
  identifier: { type: String, trim: true, required: true, unique: true, index: true },
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  name: { type: String, trim: true },
  balance: { type: costObject(false, false, true), required: true },
  budget: costObject(false, false, false)
})

projectSchema.methods.calcBalance = async function (this: ProjectDoc): Promise<BaseCurrencyMoney> {
  let sum = 0
  const travels = mongoose.connection.collection('travels').find({ project: this._id, state: 'refunded' })
  const expenseReports = mongoose.connection.collection('expensereports').find({ project: this._id, state: 'refunded' })
  const healthCareCosts = mongoose.connection.collection('healthcarecosts').find({ project: this._id, state: 'refunded' })
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
  return { amount: sum }
}

projectSchema.pre('validate', async function (this: ProjectDoc, next) {
  this.balance = await this.calcBalance()
})

export type ProjectSchema = InferSchemaType<typeof projectSchema>
export type IProject = ProjectSchema & { _id: _id }

export default model('Project', projectSchema)

export interface ProjectDoc extends Methods, HydratedDocument<Project> {}
