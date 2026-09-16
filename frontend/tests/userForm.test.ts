import { describe, expect, it } from 'vitest'
import { getSyncedMagicLogin, prepareUserForSubmit } from '@/components/settings/elements/userForm.js'

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

describe('optional user bank account submission', () => {
  const account = { accountHolder: 'Synthetic User', iban: 'DE89370400440532013000' }
  const user = { name: { givenName: 'Synthetic', familyName: 'User' }, email: 'synthetic@example.invalid' }

  it('omits an inactive bank account and its UI toggle when creating a user', () => {
    const data = prepareUserForSubmit({
      ...user,
      settings: { bankAccountEnabled: false, bankAccount: { accountHolder: '', iban: '' } }
    } as Parameters<typeof prepareUserForSubmit>[0])
    expect(data.settings).not.toHaveProperty('bankAccount')
    expect(data.settings).not.toHaveProperty('bankAccountEnabled')
  })

  it('keeps an enabled bank account without mutating the form data', () => {
    const form = { ...user, settings: { bankAccountEnabled: true, bankAccount: account } } as Parameters<typeof prepareUserForSubmit>[0]
    expect(prepareUserForSubmit(form).settings.bankAccount).toEqual(account)
    expect(form.settings.bankAccountEnabled).toBe(true)
  })

  it('explicitly clears an existing bank account when disabled', () => {
    const data = prepareUserForSubmit({
      ...user,
      _id: '000000000000000000000001',
      settings: { bankAccountEnabled: false, bankAccount: account }
    } as Parameters<typeof prepareUserForSubmit>[0])
    expect(data.settings.bankAccount).toBeNull()
  })
})
