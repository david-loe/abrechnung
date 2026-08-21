import { AdvanceState, baseCurrency, Advance as IAdvance, idDocumentToId, refStringRegexLax } from 'abrechnung-common/types.js'
import { refStringToNumber } from 'abrechnung-common/utils/scripts.js'
import { HydratedDocument, Model, QueryFilter, Types } from 'mongoose'
import { BACKEND_CACHE } from '../db.js'
import Advance from '../models/advance.js'
import Project from '../models/project.js'
import User from '../models/user.js'
import { ValidationClientError } from './error.js'

interface ImportReferenceRow {
  owner: string
  project: string
  advances?: string[]
  currency?: string
}

interface ResolvedImportReferences {
  owner: Types.ObjectId
  project: Types.ObjectId
  advances: Types.ObjectId[]
}

interface ImportValidationIssue {
  path: string
  message: string
}

function throwImportValidationIssues(issues: ImportValidationIssue[]) {
  if (issues.length === 0) return
  throw new ValidationClientError(issues[0].message, issues)
}

function addIssue(issues: ImportValidationIssue[], rowIndex: number, path: string, message: string) {
  issues.push({ path: `${rowIndex}.${path}`, message: `CSV row ${rowIndex + 3}: ${message}` })
}

function parseAdvanceReference(reference: string) {
  const normalizedReference = reference.trim()
  if (!refStringRegexLax.test(normalizedReference)) return undefined
  const parsed = refStringToNumber(normalizedReference)
  return parsed.type === 'Advance' ? parsed.ref : undefined
}

function normalizeAdvanceSelection(advances: string[] | undefined) {
  return advances?.length === 1 && advances[0].trim() === '' ? [] : advances
}

function getImportCurrency(row: ImportReferenceRow) {
  return row.currency?.trim() || baseCurrency._id
}

export async function resolveImportReferences(rows: ImportReferenceRow[], resolveAdvances = true) {
  if (rows.length === 0) {
    throw new ValidationClientError('The CSV import does not contain any data rows.')
  }

  const normalizedRows = rows.map((row) => ({ ...row, advances: normalizeAdvanceSelection(row.advances) }))
  const ownerEmails = Array.from(new Set(normalizedRows.map(({ owner }) => owner?.trim()).filter(Boolean)))
  const projectIdentifiers = Array.from(new Set(normalizedRows.map(({ project }) => project?.trim()).filter(Boolean)))
  const parsedReferences = resolveAdvances
    ? normalizedRows.flatMap(({ advances = [] }) => advances.map(parseAdvanceReference).filter((value) => value !== undefined))
    : []

  const [users, projects, referencedAdvances] = await Promise.all([
    User.find({ email: { $in: ownerEmails } }, { email: 1 }).lean(),
    Project.find({ identifier: { $in: projectIdentifiers } }, { identifier: 1 }).lean(),
    Advance.find({ reference: { $in: parsedReferences }, historic: false }).lean()
  ])
  const usersByEmail = new Map(users.map((user) => [user.email, user]))
  const projectsByIdentifier = new Map(projects.map((project) => [project.identifier, project]))
  const advancesByReference = new Map(referencedAdvances.map((advance) => [advance.reference, advance]))
  const issues: ImportValidationIssue[] = []

  const partiallyResolved = normalizedRows.map((row, rowIndex) => {
    const owner = usersByEmail.get(row.owner?.trim())
    const project = projectsByIdentifier.get(row.project?.trim())
    if (!owner) addIssue(issues, rowIndex, 'owner', `No user found for email '${row.owner ?? ''}'.`)
    if (!project) addIssue(issues, rowIndex, 'project', `No project found for identifier '${row.project ?? ''}'.`)

    const advances: Types.ObjectId[] = []
    if (resolveAdvances && row.advances) {
      for (const [advanceIndex, referenceString] of row.advances.entries()) {
        const reference = parseAdvanceReference(referenceString)
        const advance = reference === undefined ? undefined : advancesByReference.get(reference)
        if (!advance) {
          addIssue(issues, rowIndex, `advances.${advanceIndex}`, `No active advance found for reference '${referenceString}'.`)
          continue
        }
        if (advance.state < AdvanceState.APPROVED || advance.settledOn) {
          addIssue(issues, rowIndex, `advances.${advanceIndex}`, `Advance '${referenceString}' is not available.`)
          continue
        }
        if (owner && idDocumentToId(advance.owner).toString() !== owner._id.toString()) {
          addIssue(issues, rowIndex, `advances.${advanceIndex}`, `Advance '${referenceString}' belongs to another user.`)
          continue
        }
        if (project && idDocumentToId(advance.project).toString() !== project._id.toString()) {
          addIssue(issues, rowIndex, `advances.${advanceIndex}`, `Advance '${referenceString}' belongs to another project.`)
          continue
        }
        if (idDocumentToId(advance.budget.currency).toString() !== getImportCurrency(row)) {
          addIssue(issues, rowIndex, `advances.${advanceIndex}`, `Advance '${referenceString}' uses another currency.`)
          continue
        }
        advances.push(advance._id)
      }
    }
    return { owner: owner?._id, project: project?._id, advances }
  })

  throwImportValidationIssues(issues)

  if (resolveAdvances && BACKEND_CACHE.settings.autoSelectAvailableAdvances) {
    const rowsWithoutAdvanceSelection = normalizedRows
      .map((row, index) => ({ row, resolved: partiallyResolved[index] }))
      .filter(({ row }) => row.advances === undefined)
    if (rowsWithoutAdvanceSelection.length > 0) {
      const filter = {
        historic: false,
        state: { $gte: AdvanceState.APPROVED },
        settledOn: null,
        owner: {
          $in: rowsWithoutAdvanceSelection.map(({ resolved }) => resolved.owner).filter((value): value is Types.ObjectId => Boolean(value))
        },
        project: {
          $in: rowsWithoutAdvanceSelection
            .map(({ resolved }) => resolved.project)
            .filter((value): value is Types.ObjectId => Boolean(value))
        }
      } as unknown as QueryFilter<IAdvance<Types.ObjectId>>
      const availableAdvances = await Advance.find(filter).lean()
      for (const { row, resolved } of rowsWithoutAdvanceSelection) {
        const currency = getImportCurrency(row)
        resolved.advances.push(
          ...availableAdvances
            .filter(
              (advance) =>
                idDocumentToId(advance.owner).toString() === resolved.owner?.toString() &&
                idDocumentToId(advance.project).toString() === resolved.project?.toString() &&
                idDocumentToId(advance.budget.currency).toString() === currency
            )
            .map(({ _id }) => _id)
        )
      }
    }
  }

  return partiallyResolved as unknown as ResolvedImportReferences[]
}

export function validateImportValues(
  values: (string | undefined)[],
  validValues: Set<string>,
  path: string,
  label: string,
  allowEmpty = false
) {
  const issues: ImportValidationIssue[] = []
  for (const [rowIndex, value] of values.entries()) {
    if (allowEmpty && !value) continue
    if (!value || !validValues.has(value)) {
      addIssue(issues, rowIndex, path, `No ${label} found for '${value ?? ''}'.`)
    }
  }
  throwImportValidationIssues(issues)
}

export async function validateImportDocuments<ModelType>(documents: HydratedDocument<ModelType>[]) {
  const results = await Promise.allSettled(documents.map((document) => document.validate()))
  const issues: ImportValidationIssue[] = []
  const seenIssues = new Set<string>()
  for (const [rowIndex, result] of results.entries()) {
    if (result.status === 'fulfilled') continue
    if (result.reason instanceof Error && 'errors' in result.reason) {
      const validationErrors = Object.entries(result.reason.errors as Record<string, { message: string }>)
      for (const [errorPath, error] of validationErrors) {
        const path = errorPath === 'balance.amount' ? 'budget.amount' : errorPath
        const issueKey = `${rowIndex}.${path}:${error.message}`
        if (seenIssues.has(issueKey)) continue
        seenIssues.add(issueKey)
        addIssue(issues, rowIndex, path, error.message)
      }
    } else {
      addIssue(issues, rowIndex, '', result.reason instanceof Error ? result.reason.message : String(result.reason))
    }
  }
  throwImportValidationIssues(issues)
}

export async function bulkSaveImport<ModelType>(model: Model<ModelType>, documents: HydratedDocument<ModelType>[]) {
  await validateImportDocuments(documents)
  await model.bulkSave(documents)
  return documents.map((document) => document.toObject())
}
