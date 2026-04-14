import { type ValidationReference, type ValidationResult, Validator, type ValidatorSettings } from '../report/validator.js'
import { _id, binary, Travel, TravelSettings } from '../types.js'
import { getStagesOutOfBounds } from './utils.js'

type ValidatableTravel = Pick<Travel<_id, binary>, 'stages' | 'expenses' | 'startDate' | 'endDate' | 'professionalShare'>
type TravelValidatorSettings = ValidatorSettings & { travelSettings: TravelSettings<_id> }
type TravelConflictCode = 'stagesOverlapping' | 'countryChangeBetweenStages'

type TravelValidatorFn = (travel: ValidatableTravel, settings: Required<TravelValidatorSettings>) => ValidationResult[]

function isConflictCode(code: string): code is TravelConflictCode {
  return code === 'stagesOverlapping' || code === 'countryChangeBetweenStages'
}

export function combineTravelValidationResults(results: ValidationResult[]) {
  const combined: ValidationResult[] = []
  const groupedIndexes = new Set<number>()

  for (let i = 0; i < results.length; i++) {
    if (groupedIndexes.has(i)) {
      continue
    }

    const current = results[i]
    const next = results[i + 1]

    if (
      !isConflictCode(current.code) ||
      !current.path ||
      !current.reference ||
      !next ||
      next.code !== current.code ||
      next.severity !== current.severity ||
      !next.path ||
      !next.reference
    ) {
      combined.push(current)
      continue
    }

    if (current.reference.collection !== 'stages' || next.reference.collection !== 'stages') {
      combined.push(current)
      continue
    }

    const stageIndexes = [...current.reference.index, ...next.reference.index].sort((a, b) => a - b)
    combined.push({ code: current.code, severity: current.severity, reference: { collection: 'stages', index: stageIndexes } })
    groupedIndexes.add(i)
    groupedIndexes.add(i + 1)
    i++
  }

  return combined
}

export class TravelValidator extends Validator<ValidatableTravel, TravelValidatorSettings> {
  protected validators: TravelValidatorFn[] = [
    (travel, settings) => this.getReportExpenseValidationResults(travel, settings),
    (travel, settings) => {
      if (!settings.requireReceipts) {
        return []
      }

      return travel.stages.flatMap((stage, index) =>
        Boolean(stage.cost?.amount) && (!stage.cost?.receipts || stage.cost.receipts.length < 1)
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

  protected getStageDateResults(travel: ValidatableTravel): ValidationResult[] {
    const conflicts = new Map<string, ValidationResult>()

    for (let i = 0; i < travel.stages.length; i++) {
      for (let j = 0; j < travel.stages.length; j++) {
        if (i === j) {
          continue
        }

        if (travel.stages[i].departure.valueOf() < travel.stages[j].departure.valueOf()) {
          if (travel.stages[i].arrival.valueOf() <= travel.stages[j].departure.valueOf()) {
            continue
          }
          if (travel.stages[i].arrival.valueOf() <= travel.stages[j].arrival.valueOf()) {
            conflicts.set(`stages.${i}.arrival.stagesOverlapping`, this.createStageResult(i, 'arrival', 'stagesOverlapping', 'error'))
            conflicts.set(`stages.${j}.departure.stagesOverlapping`, this.createStageResult(j, 'departure', 'stagesOverlapping', 'error'))
          } else {
            conflicts.set(`stages.${j}.arrival.stagesOverlapping`, this.createStageResult(j, 'arrival', 'stagesOverlapping', 'error'))
            conflicts.set(`stages.${j}.departure.stagesOverlapping`, this.createStageResult(j, 'departure', 'stagesOverlapping', 'error'))
          }
          continue
        }

        if (travel.stages[i].departure.valueOf() < travel.stages[j].arrival.valueOf()) {
          if (travel.stages[i].arrival.valueOf() <= travel.stages[j].arrival.valueOf()) {
            conflicts.set(`stages.${i}.arrival.stagesOverlapping`, this.createStageResult(i, 'arrival', 'stagesOverlapping', 'error'))
            conflicts.set(`stages.${i}.departure.stagesOverlapping`, this.createStageResult(i, 'departure', 'stagesOverlapping', 'error'))
          } else {
            conflicts.set(`stages.${j}.arrival.stagesOverlapping`, this.createStageResult(j, 'arrival', 'stagesOverlapping', 'error'))
            conflicts.set(`stages.${i}.departure.stagesOverlapping`, this.createStageResult(i, 'departure', 'stagesOverlapping', 'error'))
          }
        }
      }
    }

    return Array.from(conflicts.values())
  }

  protected getStageCountryResults(travel: ValidatableTravel): ValidationResult[] {
    const results: ValidationResult[] = []

    for (let i = 1; i < travel.stages.length; i++) {
      if (travel.stages[i - 1].endLocation.country._id !== travel.stages[i].startLocation.country._id) {
        results.push(this.createStageResult(i - 1, 'endLocation.country', 'countryChangeBetweenStages', 'error'))
        results.push(this.createStageResult(i, 'startLocation.country', 'countryChangeBetweenStages', 'error'))
      }
    }

    return results
  }

  private createStageResult(
    index: number,
    fieldPath: string | undefined,
    code: string,
    severity: ValidationResult['severity']
  ): ValidationResult {
    const reference: ValidationReference = { collection: 'stages', index: [index] }
    return { code, severity, path: fieldPath ? `stages.${index}.${fieldPath}` : undefined, reference }
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
