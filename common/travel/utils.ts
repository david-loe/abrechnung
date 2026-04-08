import { Stage } from '../types.js'
import { datetimeToDate } from '../utils/scripts.js'

export type TravelStage = Stage

function getBounds(startDate: Date | string, endDate: Date | string, toleranceInDays: number) {
  const start = datetimeToDate(startDate)
  start.setUTCDate(start.getUTCDate() - toleranceInDays)
  const end = datetimeToDate(endDate)
  end.setUTCDate(end.getUTCDate() + toleranceInDays)
  end.setUTCHours(23, 59, 59, 999)

  return { start, end }
}

export function getStagesOutOfBounds(
  stages: TravelStage[],
  startDate: Date | string,
  endDate: Date | string,
  toleranceInDays: number
): TravelStage[] {
  const { start, end } = getBounds(startDate, endDate, toleranceInDays)

  return stages.filter((stage) => !isStageInBounds(stage, start, end))
}

export function getStagesInBounds(
  stages: TravelStage[],
  startDate: Date | string,
  endDate: Date | string,
  toleranceInDays: number
): TravelStage[] {
  const { start, end } = getBounds(startDate, endDate, toleranceInDays)

  return stages.filter((stage) => isStageInBounds(stage, start, end))
}

function isStageInBounds(stage: TravelStage, start: Date, end: Date): boolean {
  const departure = new Date(stage.departure)
  const arrival = new Date(stage.arrival)

  return departure >= start && arrival <= end
}
