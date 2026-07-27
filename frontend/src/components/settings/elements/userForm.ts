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
