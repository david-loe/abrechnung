export default [
  {
    integrationKey: 'retentionPolicy',
    schedules: { apply: { enabled: true, schedule: { type: 'daily', hour: 1, minute: 0 } } },
    settings: {
      deleteApprovedTravelAfterXDaysUnused: 0,
      deleteInWorkReportsAfterXDaysUnused: 0,
      deleteBookedAfterXDays: 0,
      mailXDaysBeforeDeletion: 7
    }
  },
  { integrationKey: 'lumpSums', schedules: { sync: { enabled: true, schedule: { type: 'daily', hour: 1, minute: 0 } } }, settings: {} }
] as const
