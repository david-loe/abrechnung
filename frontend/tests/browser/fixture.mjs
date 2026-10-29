import assert from 'node:assert/strict'

export async function browserFixture(browser) {
  const context = await browser.newContext({ locale: 'en-US', serviceWorkers: 'block' })
  const user = {
    _id: '000000000000000000000001',
    name: { givenName: 'Test', familyName: 'Admin' },
    email: 'admin@example.invalid',
    access: { user: true, admin: true },
    settings: { language: 'en', hasUserSetLanguage: true },
    projects: { assigned: [], supervised: [] },
    fk: {},
    vehicleRegistration: [{ _id: '000000000000000000000099', name: 'Registration.png', type: 'image/png' }]
  }
  const state = {
    user,
    users: [{ ...user, _id: '000000000000000000000002', name: { givenName: 'Ada', familyName: 'Lovelace' }, email: 'ada@example.invalid' }],
    categories: [
      {
        _id: '000000000000000000000010',
        name: 'Travel',
        for: 'Travel',
        style: { color: '#336699', text: 'white' },
        ledgerAccount: 'ledger'
      },
      { _id: '000000000000000000000011', name: 'Meals', for: 'both', style: { color: '#336699', text: 'white' }, ledgerAccount: 'ledger' }
    ],
    handlers: {},
    requests: [],
    errors: []
  }
  const form = {
    _id: { type: 'hidden' },
    name: {
      type: 'object',
      schema: {
        givenName: { type: 'text', label: 'Given name', rules: 'required' },
        familyName: { type: 'text', label: 'Family name', rules: 'required' }
      }
    },
    email: { type: 'text', label: 'Email', rules: 'required|email' },
    settings: { type: 'object', schema: {} },
    fk: { type: 'object', schema: { magiclogin: { type: 'text', label: 'Magic login' } } }
  }
  context.on('page', (page) => page.on('pageerror', (error) => state.errors.push(error.message)))
  await context.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/', '')
    state.requests.push({ path, method: request.method(), query: url.search })
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && !['auth/ldapauth', 'auth/magiclogin'].includes(path)) {
      assert.equal(request.headers()['x-csrf-token'], 'a'.repeat(43), 'Cookie writes include the session CSRF token')
    }
    const handler = state.handlers[`${request.method()} ${path}`]
    if (handler) {
      await handler(route)
      return
    }
    if (path === 'auth/csrf') {
      await route.fulfill({ json: { csrfToken: 'a'.repeat(43) }, headers: { 'Cache-Control': 'no-store' } })
      return
    }
    if (path === 'documentFile' && request.method() === 'DELETE') {
      await route.fulfill({ json: { deletedCount: 1 } })
      return
    }
    if (path === 'documentFile') {
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8LrH8AAAAASUVORK5CYII=', 'base64')
      })
      return
    }
    if (path === 'auth/authenticated') {
      await route.fulfill({
        json: { userId: state.user._id, cacheScope: 'browser-example', expiresAt: '2099-01-01T00:00:00Z', permissions: state.user.access }
      })
      return
    }
    if (path === 'admin/user' && request.method() === 'POST') {
      const value = request.postDataJSON()
      value._id ??= '000000000000000000000003'
      state.users = [...state.users.filter((user) => user._id !== value._id), { ...state.user, ...value }]
      await route.fulfill({ json: { message: 'alerts.successSaving', result: value } })
      return
    }
    if (path === 'user/vehicleRegistration' && request.method() === 'POST') {
      state.user.vehicleRegistration = []
      await route.fulfill({ json: { message: 'alerts.successSaving', result: state.user } })
      return
    }
    let categories = state.categories
    const filter = url.searchParams.get('filterJSON')
    if (path === 'category' && filter) {
      const pattern = JSON.parse(Buffer.from(filter, 'base64').toString()).name?.$regex
      if (pattern) categories = categories.filter(({ name }) => name.toLowerCase().includes(pattern.toLowerCase()))
    }
    const responses = {
      user: state.user,
      'admin/user': state.users,
      'admin/user/form': form,
      users: state.users,
      category: categories,
      'admin/category/form': { name: { type: 'text', label: 'Name' } },
      currency: [],
      country: [],
      healthInsurance: [],
      organisation: [],
      project: [],
      'admin/ledgerAccount': [],
      specialLumpSums: {},
      'user/actionCounts': {},
      settings: { version: '3.1.0', isReadOnly: false, disableReportType: {} },
      travelSettings: { fallbackLumpSumCountry: 'DE' },
      printerSettings: {},
      displaySettings: {
        nameDisplayFormat: 'givenNameFirst',
        locale: { default: 'en', fallback: 'en', overwrite: {} },
        accessIcons: {},
        reportTypeIcons: {}
      }
    }
    const data = responses[path]
    await route.fulfill({
      status: data === undefined ? 404 : 200,
      json: { data, meta: { count: Array.isArray(data) ? data.length : 1, page: 1, limit: 5, countPages: 1 } }
    })
  })
  return {
    context,
    state,
    async close() {
      try {
        assert.deepEqual(state.errors, [], 'No uncaught browser errors')
      } finally {
        await context.close()
      }
    }
  }
}
