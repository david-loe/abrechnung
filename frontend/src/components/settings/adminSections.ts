export const adminSectionGroups = [
  { id: 'data', labelKey: 'labels.data' },
  { id: 'configuration', labelKey: 'labels.configuration' },
  { id: 'integrations', labelKey: 'labels.integrations' },
  { id: 'tools', labelKey: 'labels.tools' }
] as const

export type AdminSectionGroupId = (typeof adminSectionGroups)[number]['id']

export type AdminSubsection = { id: string; labelKey: `labels.${string}`; keywords: string[] }

export type AdminSectionId =
  | 'users'
  | 'projects'
  | 'organisations'
  | 'categories'
  | 'countries'
  | 'currencies'
  | 'healthInsurances'
  | 'travelSettings'
  | 'connectionSettings'
  | 'displaySettings'
  | 'printerSettings'
  | 'settings'
  | 'webhooks'
  | 'lumpSumSync'
  | 'retentionPolicy'
  | 'stats'
  | 'adminTools'

export type AdminSearchKeywordKey = `settingsSearch.${AdminSectionId}`

export type AdminSection = {
  id: AdminSectionId
  path: string
  routeName: `admin-${string}`
  group: AdminSectionGroupId
  labelKey: `labels.${AdminSectionId}`
  keywordKey: AdminSearchKeywordKey
  subsections?: readonly AdminSubsection[]
}

export const adminSections: readonly AdminSection[] = [
  {
    id: 'users',
    path: 'users',
    routeName: 'admin-users',
    group: 'data',
    labelKey: 'labels.users',
    keywordKey: 'settingsSearch.users',
    subsections: [
      { id: 'user-list', labelKey: 'labels.userList', keywords: ['directory', 'table'] },
      { id: 'user-import', labelKey: 'labels.userImport', keywords: ['csv', 'bulk', 'upload'] },
      { id: 'merge-users', labelKey: 'labels.mergeUsers', keywords: ['duplicate', 'combine'] }
    ]
  },
  {
    id: 'projects',
    path: 'projects',
    routeName: 'admin-projects',
    group: 'data',
    labelKey: 'labels.projects',
    keywordKey: 'settingsSearch.projects',
    subsections: [
      { id: 'project-list', labelKey: 'labels.projectList', keywords: ['directory', 'table'] },
      { id: 'project-import', labelKey: 'labels.projectImport', keywords: ['csv', 'bulk', 'upload'] }
    ]
  },
  {
    id: 'organisations',
    path: 'organisations',
    routeName: 'admin-organisations',
    group: 'data',
    labelKey: 'labels.organisations',
    keywordKey: 'settingsSearch.organisations'
  },
  {
    id: 'categories',
    path: 'categories',
    routeName: 'admin-categories',
    group: 'data',
    labelKey: 'labels.categories',
    keywordKey: 'settingsSearch.categories'
  },
  {
    id: 'countries',
    path: 'countries',
    routeName: 'admin-countries',
    group: 'data',
    labelKey: 'labels.countries',
    keywordKey: 'settingsSearch.countries'
  },
  {
    id: 'currencies',
    path: 'currencies',
    routeName: 'admin-currencies',
    group: 'data',
    labelKey: 'labels.currencies',
    keywordKey: 'settingsSearch.currencies'
  },
  {
    id: 'healthInsurances',
    path: 'health-insurances',
    routeName: 'admin-health-insurances',
    group: 'data',
    labelKey: 'labels.healthInsurances',
    keywordKey: 'settingsSearch.healthInsurances'
  },
  {
    id: 'travelSettings',
    path: 'travel-settings',
    routeName: 'admin-travel-settings',
    group: 'configuration',
    labelKey: 'labels.travelSettings',
    keywordKey: 'settingsSearch.travelSettings'
  },
  {
    id: 'connectionSettings',
    path: 'connection-settings',
    routeName: 'admin-connection-settings',
    group: 'configuration',
    labelKey: 'labels.connectionSettings',
    keywordKey: 'settingsSearch.connectionSettings'
  },
  {
    id: 'displaySettings',
    path: 'display-settings',
    routeName: 'admin-display-settings',
    group: 'configuration',
    labelKey: 'labels.displaySettings',
    keywordKey: 'settingsSearch.displaySettings'
  },
  {
    id: 'printerSettings',
    path: 'printer-settings',
    routeName: 'admin-printer-settings',
    group: 'configuration',
    labelKey: 'labels.printerSettings',
    keywordKey: 'settingsSearch.printerSettings'
  },
  {
    id: 'settings',
    path: 'settings',
    routeName: 'admin-settings',
    group: 'configuration',
    labelKey: 'labels.settings',
    keywordKey: 'settingsSearch.settings'
  },
  {
    id: 'webhooks',
    path: 'integrations/webhooks',
    routeName: 'admin-webhooks',
    group: 'integrations',
    labelKey: 'labels.webhooks',
    keywordKey: 'settingsSearch.webhooks'
  },
  {
    id: 'lumpSumSync',
    path: 'integrations/lump-sum-sync',
    routeName: 'admin-lump-sum-sync',
    group: 'integrations',
    labelKey: 'labels.lumpSumSync',
    keywordKey: 'settingsSearch.lumpSumSync'
  },
  {
    id: 'retentionPolicy',
    path: 'retention-policy',
    routeName: 'admin-retention-policy',
    group: 'configuration',
    labelKey: 'labels.retentionPolicy',
    keywordKey: 'settingsSearch.retentionPolicy'
  },
  { id: 'stats', path: 'stats', routeName: 'admin-stats', group: 'tools', labelKey: 'labels.stats', keywordKey: 'settingsSearch.stats' },
  {
    id: 'adminTools',
    path: 'admin-tools',
    routeName: 'admin-admin-tools',
    group: 'tools',
    labelKey: 'labels.adminTools',
    keywordKey: 'settingsSearch.adminTools'
  }
]

export const defaultAdminSection = adminSections[0]

export function getAdminSectionById(id?: string | null) {
  return adminSections.find((section) => section.id === id)
}

export function getAdminSectionByRouteName(name?: string | symbol | null) {
  if (typeof name !== 'string') {
    return undefined
  }
  return adminSections.find((section) => section.routeName === name)
}
