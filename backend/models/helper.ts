import {
  AddUp,
  AdvanceBase,
  AnyState,
  FlatAddUp,
  hexColorRegex,
  IdDocument,
  idDocumentToId,
  Log,
  Project,
  ReportModelName,
  textColors,
  UserSimple
} from 'abrechnung-common/types.js'
import mongoose, { HydratedDocument, PopulateOptions, Query, Schema, Types } from 'mongoose'
import { AdvanceDoc } from './advance.js'
import { ProjectDoc } from './project.js'

export function costObject(
  exchangeRate = true,
  receipts = true,
  required = false,
  defaultCurrency: string | null = null,
  defaultAmount: number | null = null,
  min: number | undefined = 0
) {
  // biome-ignore lint/suspicious/noExplicitAny: typing to complex
  const type: any = { amount: { type: Number, min, required: required, default: required && defaultAmount === null ? 0 : defaultAmount } }
  if (exchangeRate) {
    type.exchangeRate = { date: { type: Date }, rate: { type: Number, min: 0 }, amount: { type: Number, min } }
    type.currency = { type: String, ref: 'Currency', required: required, default: defaultCurrency }
  }
  if (receipts) {
    type.receipts = { type: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile', required: required }] }
    type.date = {
      type: Date,
      validate: { validator: (v: Date | string | number) => Date.now() >= new Date(v).valueOf(), message: 'futureNotAllowed' },
      required: required
    }
  }
  return { type, required, default: () => ({}) }
}

export function logObject<T extends AnyState>(states: readonly T[]) {
  const logEntry = { type: { on: { type: Date, required: true }, by: { type: Schema.Types.ObjectId, ref: 'User', required: true } } }
  const log: { type: { [key in T]?: typeof logEntry }; required: true; default: () => Record<string, never> } = {
    type: {},
    required: true,
    default: () => ({})
  }
  for (const state of states) {
    log.type[state] = logEntry
  }
  return log
}

export function setLog(doc: HydratedDocument<{ state: AnyState; log: Log<Types.ObjectId>; editor: UserSimple<Types.ObjectId> }>) {
  if (doc.isModified('state')) {
    doc.log[doc.state] = { on: new Date(), by: doc.editor }
  }
}

export function colorSchema<L extends string | undefined>(label: L, required = true) {
  return {
    type: {
      color: { type: String, required: true, validate: hexColorRegex, description: 'Hex: #rrggbb / #rgb' },
      text: { type: String, enum: textColors, required: true }
    },
    required,
    label
  }
}

export function requestBaseSchema<S extends AnyState = AnyState>(
  stages: readonly S[],
  defaultState: S,
  modelName: string,
  advancesAndAddUp = true,
  addUpLumpSums = true
) {
  const schema = {
    name: { type: String },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    state: { type: Number, required: true, enum: stages, default: defaultState },
    log: logObject(stages),
    editor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String },
    comments: {
      type: [
        {
          text: { type: String },
          author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          toState: { type: Number, required: true, enum: stages }
        }
      ]
    },
    bookingRemark: { type: String },
    history: { type: [{ type: Schema.Types.ObjectId, ref: modelName }] },
    historic: { type: Boolean, required: true, default: false }
  }

  const addUp = Object.assign(
    {
      project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
      balance: costObject(false, false, true),
      total: costObject(false, false, true),
      expenses: costObject(false, false, true),
      advance: costObject(false, false, true),
      advanceOverflow: { type: Boolean, required: true, default: false }
    },
    addUpLumpSums ? { lumpSums: costObject(false, false, true) } : {}
  )
  const schemaWithAdvances = Object.assign(
    schema,
    advancesAndAddUp
      ? {
          advances: {
            type: [{ type: Schema.Types.ObjectId, ref: 'Advance' }],
            set: (arr: IdDocument[]) => {
              const unique = Array.from(new Set(arr.map((doc) => idDocumentToId(doc).toString())))
              return unique.map((str) => new Types.ObjectId(str))
            }
          },
          addUp: { type: [addUp] }
        }
      : {}
  )

  return schemaWithAdvances
}
export function place(required = true, withPlace = true, withSpecial = true) {
  return {
    type: {
      country: { type: String, ref: 'Country', required: required },
      ...(withPlace ? { place: { type: String, required: required } } : {}),
      ...(withSpecial ? { special: { type: String } } : {})
    },
    required
  }
}
export function travelBaseSchema() {
  return {
    reason: { type: String, required: true },
    destinationPlace: place(true, true, false),
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    claimSpouseRefund: { type: Boolean },
    fellowTravelersNames: { type: String }
  }
}

export function populateSelected<DocType extends {}>(
  query: Query<DocType, DocType>,
  projectionPopulateMap: Partial<Record<keyof DocType, PopulateOptions[]>>
) {
  const projection = query.projection() || {}
  const runAll = !query.selected()
  const isExclusiv = query.selectedExclusively()
  const isInclusiv = query.selectedInclusively()
  const populates = []
  for (const key of Object.keys(projectionPopulateMap)) {
    const value = projectionPopulateMap[key as keyof DocType]
    if (!value) continue
    if (runAll || (isExclusiv && projection[key] !== 0) || (isInclusiv && projection[key] === 1)) {
      for (const populate of value) {
        populates.push(query.populate(populate))
      }
    }
  }
  return Promise.allSettled(populates)
}

export function populateAll<DocType extends {}>(
  doc: HydratedDocument<DocType>,
  projectionPopulateMap: Partial<Record<keyof DocType, PopulateOptions[]>>
) {
  const populates: Promise<unknown>[] = []
  for (const key of Object.keys(projectionPopulateMap)) {
    const value = projectionPopulateMap[key as keyof DocType]
    if (!value) continue
    for (const populate of value) {
      populates.push(doc.populate(populate))
    }
  }
  return Promise.allSettled(populates)
}

export async function offsetAdvance(
  report: { addUp: FlatAddUp<Types.ObjectId>[]; advances: AdvanceBase<Types.ObjectId>[]; _id: Types.ObjectId },
  modelName: ReportModelName
) {
  const session = await mongoose.startSession()
  // session.startTransaction() // needs Replica Set
  try {
    report.advances.sort((a, b) => a.balance.amount - b.balance.amount)
    for (const addUp of report.addUp) {
      let total = addUp.total.amount || 0
      for (const advance of report.advances) {
        if (advance.project._id.equals(idDocumentToId(addUp.project))) {
          total = await (advance as AdvanceDoc).offset(total, modelName, report._id, session)
        }
      }
    }

    // await session.commitTransaction() // needs Replica Set
  } catch (error) {
    // await session.abortTransaction() // needs Replica Set
    // biome-ignore lint/complexity/noUselessCatch: finally needs catch
    throw error
  } finally {
    await session.endSession()
  }
}

export async function addToProjectBalance(report: { addUp: AddUp[]; project: Project }) {
  const session = await mongoose.startSession()
  // session.startTransaction() // needs Replica Set
  try {
    for (const addUp of report.addUp) {
      await (addUp.project as ProjectDoc).addToBalance(addUp.total.amount, session)
    }
    // await session.commitTransaction() // needs Replica Set
  } catch (error) {
    // await session.abortTransaction() // needs Replica Set
    // biome-ignore lint/complexity/noUselessCatch: finally needs catch
    throw error
  } finally {
    await session.endSession()
  }
}
