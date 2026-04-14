export type ValidationIssueActionPayload =
  | { type: 'single-stage'; stageIndex: number }
  | { type: 'single-expense'; expenseIndex: number }
  | { type: 'multi-stage'; stageIndexes: number[] }
