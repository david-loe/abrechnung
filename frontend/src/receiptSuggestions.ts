import {
  baseCurrency,
  Category,
  Cost,
  Country,
  Currency,
  DocumentFile,
  ProjectSimple,
  ReceiptSuggestion,
  SuggestedCost,
  SuggestionReportType
} from 'abrechnung-common/types.js'
import API from './api.js'

interface SuggestionContext {
  type: 'expense' | 'stage'
  reportType: SuggestionReportType
  projectId: string
  documentFileIds: string[]
  endpointPrefix: string
}

interface CostSuggestionContext {
  categories: Category<string>[]
  currencies: Currency[]
  defaultProject: ProjectSimple<string>
  dirty: Set<string>
  reportType: SuggestionReportType
}

export type ReceiptProcessingStep = 'uploading' | 'ocr' | 'error'

export function receiptProcessingStatus(steps: ReceiptProcessingStep[], suggestionProcessing: boolean) {
  const activeSteps = new Set(steps)
  if (activeSteps.has('uploading') && activeSteps.has('ocr')) return 'receiptProcessingInProgress'
  if (activeSteps.has('uploading')) return 'receiptUploadInProgress'
  if (activeSteps.has('ocr')) return 'receiptOcrInProgress'
  if (suggestionProcessing) return 'receiptSuggestionInProgress'
  if (activeSteps.has('error')) return 'receiptProcessingFailed'
}

export async function requestReceiptSuggestion(context: SuggestionContext) {
  if (context.documentFileIds.length === 0) return undefined
  const result = await API.getter<ReceiptSuggestion>(
    `${context.endpointPrefix}suggestions`,
    { type: context.type, reportType: context.reportType, projectId: context.projectId, documentFileIds: context.documentFileIds },
    {},
    { showAlert: false }
  )
  return result.ok?.data
}

export function receiptIds(receipts: Partial<DocumentFile<string>>[]) {
  return receipts.flatMap(({ _id }) => (_id ? [_id] : []))
}

function defaultCategory(categories: Category<string>[], reportType: SuggestionReportType) {
  const available = categories.filter(({ for: value }) => value === 'both' || value === reportType)
  return available.find(({ isDefault }) => isDefault) ?? (available.length === 1 ? available[0] : undefined)
}

function positionsArePristine(cost: Cost<string>) {
  return (
    cost.positions.length === 1 &&
    cost.positions[0].kind === 'manual' &&
    cost.positions[0].grossAmount === 0 &&
    !cost.positions[0].description
  )
}

export function applySuggestedCost(cost: Cost<string>, suggestion: SuggestedCost | undefined, context: CostSuggestionContext) {
  if (!suggestion) return
  if (!context.dirty.has('currency') && cost.currency._id === baseCurrency._id && suggestion.currencyCode) {
    const currency = context.currencies.find(({ _id }) => _id === suggestion.currencyCode)
    if (currency) cost.currency = currency
  }
  if (!context.dirty.has('date') && !cost.date && suggestion.date) cost.date = suggestion.date
  if (!context.dirty.has('positions') && positionsArePristine(cost) && suggestion.positions?.length) {
    const existingPosition = cost.positions[0]
    const fallbackCategory = existingPosition.category ?? defaultCategory(context.categories, context.reportType)
    cost.positions = suggestion.positions.flatMap((position) => {
      const category = position.categoryId ? context.categories.find(({ _id }) => _id === position.categoryId) : fallbackCategory
      if (!category) return []
      return [
        {
          kind: 'manual' as const,
          description: position.description ?? '',
          grossAmount: position.grossAmount,
          vatRate: position.vatRate,
          project: existingPosition.project ?? context.defaultProject,
          category
        }
      ]
    })
  }
}

export function suggestedPlace(value: { place: string; countryCode: string } | undefined, countries: Country[]) {
  if (!value) return undefined
  const country = countries.find(({ _id }) => _id === value.countryCode)
  return country ? { place: value.place, country } : undefined
}
