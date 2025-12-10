import {
  Advance,
  ExpenseReport,
  getModelNameFromReport,
  HealthCareCost,
  idDocumentToId,
  ReportUsage,
  reportModelNames,
  Travel
} from 'abrechnung-common/types.js'
import { Model, model, mongo, Schema, Types } from 'mongoose'

type Report =
  | Travel<Types.ObjectId, mongo.Binary>
  | ExpenseReport<Types.ObjectId, mongo.Binary>
  | HealthCareCost<Types.ObjectId, mongo.Binary>
  | Advance<Types.ObjectId>

interface ReportUsageModelType extends Model<ReportUsage<Types.ObjectId>> {
  addOrUpdate(report: Report): Promise<ReportUsage<Types.ObjectId>>
}

function convert(report: Report) {
  return {
    reportId: report._id,
    reference: report.reference,
    reportModelName: getModelNameFromReport(report),
    organisationId: report.project.organisation,
    projectId: idDocumentToId(report.project)
  }
}

const reportUsageSchema = () =>
  new Schema<ReportUsage, ReportUsageModelType>(
    {
      reportId: { type: Schema.Types.ObjectId, refPath: 'reportModelName', required: true, unique: true },
      reference: { type: Number, required: true, min: 0 },
      reportModelName: { type: String, enum: reportModelNames, required: true },
      organisationId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
      projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true }
    },
    { timestamps: true }
  )

const schema = reportUsageSchema()

schema.index({ createdAt: 1 })

schema.statics.addOrUpdate = async function (report: Report): Promise<ReportUsage<Types.ObjectId>> {
  const converted = convert(report)
  return await this.findOneAndUpdate({ reportId: converted.reportId }, { $set: converted }, { upsert: true, new: true }).lean()
}

export default model<ReportUsage, ReportUsageModelType>('ReportUsage', schema)
