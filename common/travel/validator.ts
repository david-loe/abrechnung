import { type ValidationReference, type ValidationResult, Validator, type ValidatorSettings } from '../report/validator.js'
import { _id, binary, Travel, TravelSettings } from '../types.js'
import { getStagesOutOfBounds } from './utils.js'

type ValidatableTravel = Pick<Travel<_id, binary>, 'stages' | 'expenses' | 'startDate' | 'endDate' | 'professionalShare'>
type TravelValidatorSettings = ValidatorSettings & { travelSettings: TravelSettings<_id> }
type TravelConflictCode = 'stagesOverlapping' | 'countryChangeBetweenStages'
export interface TravelValidationContext {
  vehicleRegistration?: Travel<_id, binary>['stages'][number]['cost']['receipts'] | null
}

type TravelValidatorFn = (
  travel: ValidatableTravel,
  settings: Required<TravelValidatorSettings>,
  context?: TravelValidationContext
) => ValidationResult[]

function isConflictCode(code: string): code is TravelConflictCode {
  return code === 'stagesOverlapping' || code === 'countryChangeBetweenStages'
}

export function combineTravelValidationResults(results: ValidationResult[]) {
  const combined: ValidationResult[] = []
  const groupedConflictKeys = new Set<string>()

  for (const result of results) {
    if (
      !isConflictCode(result.code) ||
      !result.reference ||
      result.reference.collection !== 'stages' ||
      result.reference.index.length < 2
    ) {
      combined.push(result)
      continue
    }

    const stageIndexes = Array.from(new Set(result.reference.index)).sort((a, b) => a - b)
    const conflictKey = `${result.code}:${result.severity}:${stageIndexes.join('-')}`
    if (groupedConflictKeys.has(conflictKey)) {
      continue
    }

    combined.push({ code: result.code, severity: result.severity, reference: { collection: 'stages', index: stageIndexes } })
    groupedConflictKeys.add(conflictKey)
  }

  return combined
}

export class TravelValidator extends Validator<ValidatableTravel, TravelValidatorSettings, TravelValidationContext> {
  protected validators: TravelValidatorFn[] = [
    (travel, settings) => this.getReportExpenseValidationResults(travel, settings),
    (travel, settings, context) => {
      if (!settings.requireReceipts) {
        return []
      }

      return travel.stages.flatMap((stage, index) =>
        this.isStageReceiptMissingForReview(stage, settings, context)
          ? [this.createStageResult(index, 'cost.receipts', 'requiredForReview', 'error')]
          : []
      )
    },
    (travel) => (travel.stages.length < 1 ? [{ code: 'noData.stage', severity: 'error' }] : []),
    (travel) => this.getStageDateResults(travel),
    (travel) => this.getStageCountryResults(travel),
    (travel, settings) => {
      if (travel.stages.length < 1) {
        return []
      }

      const travelLength =
        new Date(travel.stages[travel.stages.length - 1].arrival).valueOf() - new Date(travel.stages[0].departure).valueOf()
      const limit = settings.travelSettings.minHoursOfTravel * 3_600_000

      return travelLength < limit ? [{ code: 'travelLengthToShort', severity: 'warning' }] : []
    },
    (travel, settings) => {
      return travel.professionalShare !== null && travel.professionalShare < settings.travelSettings.minProfessionalShare
        ? [{ code: 'professionalShareToSmall', severity: 'warning' }]
        : []
    },
    (travel, settings) => {
      const outOfBoundsStages = getStagesOutOfBounds(
        travel.stages,
        travel.startDate,
        travel.endDate,
        settings.travelSettings.toleranceStageDatesToApprovedTravelDates
      )
      return travel.stages.flatMap((stage, index) =>
        outOfBoundsStages.includes(stage) ? [this.createStageResult(index, undefined, 'stageOutOfBounds', 'warning')] : []
      )
    }
  ]

  constructor(travelSettings: TravelSettings<_id>) {
    super({ travelSettings } as TravelValidatorSettings)
  }

  updateSettings(travelSettings: TravelSettings<_id>) {
    this.settings = { ...this.settings, travelSettings }
  }

  private isStageReceiptMissingForReview(
    stage: ValidatableTravel['stages'][number],
    settings: Required<TravelValidatorSettings>,
    context?: TravelValidationContext
  ) {
    if (!stage.cost?.amount) {
      return false
    }

    if (stage.cost.receipts && stage.cost.receipts.length > 0) {
      return false
    }

    if (stage.transport.type !== 'ownCar') {
      return true
    }

    if (settings.travelSettings.vehicleRegistrationWhenUsingOwnCar !== 'required') {
      return false
    }

    return !context?.vehicleRegistration || context.vehicleRegistration.length < 1
  }

  protected getStageDateResults(travel: ValidatableTravel): ValidationResult[] {
    const conflicts: ValidationResult[] = []

    for (let i = 0; i < travel.stages.length; i++) {
      for (let j = i + 1; j < travel.stages.length; j++) {
        const stageA = travel.stages[i]
        const stageB = travel.stages[j]
        const firstIndex = stageA.departure.valueOf() <= stageB.departure.valueOf() ? i : j
        const secondIndex = firstIndex === i ? j : i
        const firstStage = travel.stages[firstIndex]
        const secondStage = travel.stages[secondIndex]

        if (firstStage.arrival.valueOf() <= secondStage.departure.valueOf()) {
          continue
        }

        if (firstStage.arrival.valueOf() <= secondStage.arrival.valueOf()) {
          conflicts.push(...this.createStageConflictResults(firstIndex, 'arrival', secondIndex, 'departure', 'stagesOverlapping', 'error'))
          continue
        }

        conflicts.push(
          ...this.createStageConflictResults(secondIndex, 'departure', secondIndex, 'arrival', 'stagesOverlapping', 'error', [
            firstIndex,
            secondIndex
          ])
        )
      }
    }

    return conflicts
  }

  protected getStageCountryResults(travel: ValidatableTravel): ValidationResult[] {
    const results: ValidationResult[] = []

    for (let i = 1; i < travel.stages.length; i++) {
      if (travel.stages[i - 1].endLocation.country._id !== travel.stages[i].startLocation.country._id) {
        results.push(
          ...this.createStageConflictResults(
            i - 1,
            'endLocation.country',
            i,
            'startLocation.country',
            'countryChangeBetweenStages',
            'error'
          )
        )
      }
    }

    return results
  }

  private createStageResult(
    index: number,
    fieldPath: string | undefined,
    code: string,
    severity: ValidationResult['severity'],
    referenceIndexes = [index]
  ): ValidationResult {
    const reference: ValidationReference = { collection: 'stages', index: referenceIndexes }
    return { code, severity, path: fieldPath ? `stages.${index}.${fieldPath}` : undefined, reference }
  }

  private createStageConflictResults(
    firstIndex: number,
    firstFieldPath: string,
    secondIndex: number,
    secondFieldPath: string,
    code: string,
    severity: ValidationResult['severity'],
    referenceIndexes = [firstIndex, secondIndex]
  ) {
    return [
      this.createStageResult(firstIndex, firstFieldPath, code, severity, referenceIndexes),
      this.createStageResult(secondIndex, secondFieldPath, code, severity, referenceIndexes)
    ]
  }

  getCalculationBlockingResults(travel: Pick<Travel<_id, binary>, 'stages'>) {
    return TravelValidator.getCalculationBlockingResultsFromStages(travel)
  }

  static hasCalculationBlockingErrors(travel: Pick<Travel<_id, binary>, 'stages'>) {
    return TravelValidator.getCalculationBlockingResultsFromStages(travel).length > 0
  }

  private static getCalculationBlockingResultsFromStages(travel: Pick<Travel<_id, binary>, 'stages'>) {
    const travelContext = TravelValidator.getEmptyTravelContext(travel)
    const validator = new TravelValidator({} as TravelSettings<_id>)
    return [...validator.getStageDateResults(travelContext), ...validator.getStageCountryResults(travelContext)]
  }

  private static getEmptyTravelContext(travel: Pick<Travel<_id, binary>, 'stages'>): ValidatableTravel {
    return {
      stages: Array.isArray(travel.stages) ? travel.stages : [],
      expenses: [],
      startDate: new Date(0),
      endDate: new Date(0),
      professionalShare: null
    }
  }
}
