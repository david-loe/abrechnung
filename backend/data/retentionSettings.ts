export default {
  enabled: true,
  schedule: { type: 'daily', hour: 1, minute: 0 },
  retentionPolicy: {
    deleteApprovedTravelAfterXDaysUnused: 0,
    deleteInWorkReportsAfterXDaysUnused: 0,
    deleteBookedAfterXDays: 0,
    mailXDaysBeforeDeletion: 7
  }
} as const
