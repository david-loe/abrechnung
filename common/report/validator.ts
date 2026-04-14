import { Expense, ExpenseReport, HealthCareCost } from '../types.js'

export type ValidationSeverity = 'info' | 'warning' | 'error'

export interface ValidationReference {
  collection: 'expenses' | 'stages'
  index: number[]
}

export interface ValidationResult {
  code: string
  path?: string
  severity: ValidationSeverity
  reference?: ValidationReference
}

export interface ValidationSummary {
  results: ValidationResult[]
  isComplete: boolean
  canEnterReview: boolean
}

export type ValidatorSettings = { requireReceipts?: boolean }

type ExpenseValidatorRuntimeSettings = Required<ValidatorSettings> & { pathPrefix?: string; reference?: ValidationReference }

type ReportLike = Pick<ExpenseReport | HealthCareCost, 'expenses'>
type ReportValidatorFn<TReport extends ReportLike, TSettings extends ValidatorSettings> = (
  report: TReport,
  settings: Required<TSettings>
) => ValidationResult[]
type ExpenseValidatorFn = (expense: Partial<Expense>, settings: ExpenseValidatorRuntimeSettings) => ValidationResult[]

export class Validator<TReport extends ReportLike = ReportLike, TSettings extends ValidatorSettings = ValidatorSettings> {
  protected settings: Required<TSettings>
  protected expenseValidators: ExpenseValidatorFn[] = [
    (expense, settings) => {
      if (!settings.requireReceipts) {
        return []
      }
      return !expense.cost?.receipts || expense.cost.receipts.length < 1
        ? [{ code: 'requiredForReview', severity: 'error', path: `${settings.pathPrefix}cost.receipts`, reference: settings.reference }]
        : []
    }
  ]

  protected validators: ReportValidatorFn<TReport, TSettings>[] = [
    (report) => (report.expenses.length < 1 ? [{ code: 'noData.expense', severity: 'error' }] : []),
    (report, settings) => this.getReportExpenseValidationResults(report, settings)
  ]

  constructor(settings = {} as TSettings) {
    this.settings = { requireReceipts: true, ...settings } as Required<TSettings>
  }

  protected getReportExpenseValidationResults(report: TReport, settings: Required<TSettings>): ValidationResult[] {
    const results: ValidationResult[] = []

    for (const [index, expense] of report.expenses.entries()) {
      results.push(...this.getExpenseValidationResults(expense, `expenses.${index}.`, { collection: 'expenses', index: [index] }))
    }

    return results
  }

  getExpenseValidationResults(expense: Partial<Expense>, pathPrefix = '', reference?: ValidationReference): ValidationResult[] {
    const settings = { ...this.settings, pathPrefix, reference } as ExpenseValidatorRuntimeSettings
    return this.expenseValidators.flatMap((validator) => validator(expense, settings))
  }

  getValidationResults(report: TReport): ValidationResult[] {
    return this.validators.flatMap((validator) => validator(report, this.settings))
  }

  getValidationSummary(report: TReport): ValidationSummary {
    const results = this.getValidationResults(report)
    const hasErrors = results.some((result) => result.severity === 'error')

    return { results, isComplete: !hasErrors, canEnterReview: !hasErrors }
  }

  isExpenseComplete(expense: Partial<Expense>) {
    return !this.getExpenseValidationResults(expense).some((result) => result.severity === 'error')
  }
}
