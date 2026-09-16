import type { User } from 'abrechnung-common/types.js'

export function prepareUserForSubmit(user: User & { settings: User['settings'] & { bankAccountEnabled?: boolean } }) {
  const { bankAccountEnabled, bankAccount, ...settings } = user.settings
  return { ...user, settings: { ...settings, ...(bankAccountEnabled ? { bankAccount } : user._id ? { bankAccount: null } : {}) } }
}

interface MagicLoginSyncOptions {
  email: string | null | undefined
  existingUser: boolean
  magicLogin: string | null | undefined
  magicLoginEnabled: boolean
  previousEmail: string | null | undefined
}

export function getSyncedMagicLogin({ email, existingUser, magicLogin, magicLoginEnabled, previousEmail }: MagicLoginSyncOptions) {
  if (existingUser || !magicLoginEnabled || (magicLogin ?? '') !== (previousEmail ?? '')) {
    return magicLogin
  }

  return email
}
