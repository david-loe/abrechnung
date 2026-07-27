import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('axios', () => ({ default: { get: vi.fn(), isAxiosError: vi.fn(() => true) } }))
vi.mock('@/i18n.js', () => ({ default: { global: { t: (value: string) => value } } }))
vi.mock('@/session.js', () => ({ purgeSession: vi.fn(), sessionState: { isOnline: { value: true } } }))

import API from '@/api.js'
import { purgeSession } from '@/session.js'

const unauthorized = { response: { status: 401, data: { message: 'Unauthorized' } } }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(axios.get).mockRejectedValue(unauthorized)
})

describe('API authentication errors', () => {
  it('keeps the session for an expected authorization failure', async () => {
    await API.getter('users', {}, {}, { showAlert: false, handleAuthenticationError: false })

    expect(purgeSession).not.toHaveBeenCalled()
  })

  it('purges the session for normal authenticated requests', async () => {
    await API.getter('user')

    expect(purgeSession).toHaveBeenCalledOnce()
  })
})
