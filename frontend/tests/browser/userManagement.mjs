import assert from 'node:assert/strict'

export async function testUserManagement(browser, origin) {
  const context = await browser.newContext({ locale: 'en-US', serviceWorkers: 'block' })
  const admin = {
    _id: '000000000000000000000001',
    name: { givenName: 'Test', familyName: 'Admin' },
    email: 'admin@example.invalid',
    access: { user: true, admin: true },
    settings: { language: 'en', hasUserSetLanguage: true },
    projects: { assigned: [], supervised: [] },
    fk: {}
  }
  let users = [
    { ...admin, _id: '000000000000000000000002', name: { givenName: 'Ada', familyName: 'Lovelace' }, email: 'ada@example.invalid' }
  ]
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
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/', '')
    if (path === 'auth/authenticated') {
      await route.fulfill({
        json: { userId: admin._id, cacheScope: 'user-management-test', expiresAt: '2099-01-01T00:00:00Z', permissions: admin.access }
      })
      return
    }
    if (path === 'admin/user' && route.request().method() === 'POST') {
      const user = route.request().postDataJSON()
      user._id ??= '000000000000000000000003'
      users = [...users.filter((existing) => existing._id !== user._id), { ...admin, ...user }]
      await route.fulfill({ json: { message: 'alerts.successSaving', result: user } })
      return
    }
    const responses = {
      user: admin,
      'admin/user': users,
      'admin/user/form': form,
      users,
      currency: [],
      country: [],
      healthInsurance: [],
      organisation: [],
      category: [],
      project: [],
      'admin/ledgerAccount': [],
      specialLumpSums: {},
      'user/actionCounts': {},
      settings: { version: '3.0.3', isReadOnly: false, disableReportType: {} },
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

  try {
    const page = await context.newPage()
    // Given an administrator viewing the user directory.
    await page.goto(`${origin}/admin/users`)
    const ada = page.getByRole('row', { name: /Ada Lovelace/ })
    await ada.waitFor()

    // When an existing user's email is changed, it remains changed after reloading.
    await ada.getByRole('button').first().click()
    await page.getByLabel('Email', { exact: true }).fill('ada.updated@example.invalid')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('row', { name: /ada.updated@example.invalid/ }).waitFor()
    await page.reload()
    await page.getByRole('row', { name: /ada.updated@example.invalid/ }).waitFor()
    assert.equal(await page.getByRole('row', { name: /ada@example.invalid/ }).count(), 0)

    // When a new user is saved, that user appears in the directory after reloading.
    await page.getByRole('button', { name: 'Add User', exact: true }).click()
    await page.getByLabel('Given name', { exact: true }).fill('Grace')
    await page.getByLabel('Family name', { exact: true }).fill('Hopper')
    await page.getByLabel('Email', { exact: true }).fill('grace@example.invalid')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('row', { name: /Grace Hopper.*grace@example.invalid/ }).waitFor()
    await page.reload()
    await page.getByRole('row', { name: /Grace Hopper.*grace@example.invalid/ }).waitFor()
    console.log(`${browser.browserType().name()}: admin can view, edit and create users`)
  } finally {
    await context.close()
  }
}
