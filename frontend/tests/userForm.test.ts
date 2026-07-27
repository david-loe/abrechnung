import { describe, expect, it } from 'vitest'
import { getSyncedMagicLogin } from '@/components/settings/elements/userForm.js'

describe('user form magic-login default', () => {
  it('defaults an empty magic login to the initial email', () => {
    expect(
      getSyncedMagicLogin({
        email: 'user@example.com',
        existingUser: false,
        magicLogin: undefined,
        magicLoginEnabled: true,
        previousEmail: undefined
      })
    ).toBe('user@example.com')
  })

  it('keeps the magic login synchronized while it matches the previous email', () => {
    expect(
      getSyncedMagicLogin({
        email: 'new@example.com',
        existingUser: false,
        magicLogin: 'old@example.com',
        magicLoginEnabled: true,
        previousEmail: 'old@example.com'
      })
    ).toBe('new@example.com')
  })

  it.each([
    ['a custom value', 'login@example.com'],
    ['a manually cleared value', '']
  ])('preserves %s', (_description, magicLogin) => {
    expect(
      getSyncedMagicLogin({
        email: 'new@example.com',
        existingUser: false,
        magicLogin,
        magicLoginEnabled: true,
        previousEmail: 'old@example.com'
      })
    ).toBe(magicLogin)
  })

  it('preserves the magic login for existing users', () => {
    expect(
      getSyncedMagicLogin({
        email: 'new@example.com',
        existingUser: true,
        magicLogin: 'old@example.com',
        magicLoginEnabled: true,
        previousEmail: 'old@example.com'
      })
    ).toBe('old@example.com')
  })

  it('does not populate magic login when the strategy is disabled', () => {
    expect(
      getSyncedMagicLogin({
        email: 'user@example.com',
        existingUser: false,
        magicLogin: undefined,
        magicLoginEnabled: false,
        previousEmail: undefined
      })
    ).toBeUndefined()
  })
})
