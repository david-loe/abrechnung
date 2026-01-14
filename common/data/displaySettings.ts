export default {
  auth: { magiclogin: true, microsoft: true, ldapauth: true, oidc: true },
  oidc: { label: 'OIDC', icon: 'key' },
  locale: { default: 'de', fallback: 'de', overwrite: { de: {}, en: {}, fr: {}, ru: {}, es: {}, kk: {} } },
  nameDisplayFormat: 'givenNameFirst',
  helpButton: {
    enabled: true,
    examinersMail: true,
    examinersMsTeams: false,
    customOptions: [] as { label: string; link: string; icon: string }[]
  },
  accessIcons: {
    admin: ['person-fill'] as string[],
    'appliedFor:travel': ['airplane', 'plus'] as string[],
    'appliedFor:advance': ['briefcase', 'cash-coin', 'plus'] as string[],
    'approve/travel': ['airplane', 'clipboard-check'] as string[],
    'approve/advance': ['briefcase', 'cash-coin', 'clipboard-check'] as string[],
    'approved:travel': ['airplane', 'calendar-check', 'plus'] as string[],
    'examine/expenseReport': ['coin', 'pencil-square'] as string[],
    'examine/healthCareCost': ['hospital', 'pencil-square'] as string[],
    'examine/travel': ['airplane', 'pencil-square'] as string[],
    'inWork:expenseReport': ['coin', 'plus'] as string[],
    'inWork:healthCareCost': ['hospital', 'plus'] as string[],
    'book/advance': ['briefcase', 'cash-coin', 'bank'] as string[],
    'book/expenseReport': ['coin', 'bank'] as string[],
    'book/healthCareCost': ['hospital', 'bank'] as string[],
    'book/travel': ['airplane', 'bank'] as string[],
    user: ['card-list'] as string[]
  },
  reportTypeIcons: {
    travel: ['airplane'] as string[],
    expenseReport: ['coin'] as string[],
    advance: ['briefcase', 'cash-coin'] as string[],
    healthCareCost: ['hospital'] as string[]
  },
  stateColors: {
    '-10': { color: '#E8998D', text: 'black' },
    '0': { color: '#cae5ff', text: 'black' },
    '10': { color: '#89BBFE', text: 'black' },
    '20': { color: '#6f8ab7', text: 'white' },
    '30': { color: '#615d6c', text: 'white' },
    '40': { color: '#5E8C61', text: 'white' }
  }
} as const
