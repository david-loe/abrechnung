export default {
  defaultAccess: {
    admin: false,
    'appliedFor:advance': true,
    'appliedFor:travel': true,
    'approve/advance': false,
    'approve/travel': false,
    'approved:travel': false,
    'book/advance': false,
    'book/expenseReport': false,
    'book/healthCareCost': false,
    'book/travel': false,
    'examine/expenseReport': false,
    'examine/healthCareCost': false,
    'examine/travel': false,
    'inWork:expenseReport': true,
    'inWork:healthCareCost': true,
    user: true
  },
  disableReportType: { advance: false, expenseReport: false, healthCareCost: true, travel: false },
  uploadTokenExpireAfterSeconds: 600,
  userCanSeeAllProjects: true,
  onlyShowProjectNamesOnAssigned: false,
  autoSelectAvailableAdvances: true,
  preventOwnersFromDeletingReportsAfterReviewCompleted: false,
  isReadOnly: false,
  version: '2.6.0'
} as const
