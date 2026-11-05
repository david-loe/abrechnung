import assert from 'node:assert/strict'
import { browserFixture } from './fixture.mjs'

export async function testPasskeys(browser, origin) {
  const fixture = await browserFixture(browser)
  const { context, state } = fixture
  let signedIn = true
  let enabled = true
  let sequence = 0
  const keys = []
  const challenge = 'AQIDBAUGBwgJCgsMDQ4PEA'
  state.handlers['GET displaySettings'] = (route) =>
    route.fulfill({
      json: {
        data: {
          auth: { passkey: enabled, ldapauth: true, microsoft: false, oidc: false, magiclogin: false },
          nameDisplayFormat: 'givenNameFirst',
          locale: { default: 'en', fallback: 'en', overwrite: {} },
          accessIcons: {},
          reportTypeIcons: {},
          helpButton: { enabled: false }
        }
      }
    })
  state.handlers['GET auth/authenticated'] = (route) =>
    signedIn
      ? route.fulfill({
          json: { userId: state.user._id, cacheScope: 'passkeys', expiresAt: '2099-01-01T00:00:00Z', permissions: state.user.access }
        })
      : route.fulfill({ status: 401, json: {} })
  state.handlers['GET user/passkeys'] = (route) => route.fulfill({ json: { data: keys } })
  state.handlers['POST user/passkeys/options'] = (route) =>
    route.fulfill({
      json: {
        result: {
          challengeId: 'registration',
          optionsJSON: {
            challenge,
            rp: { name: 'Abrechnung', id: new URL(origin).hostname },
            user: { id: 'AQIDBA', name: state.user.email, displayName: 'Test Admin' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: { residentKey: 'required', userVerification: 'required' }
          }
        }
      }
    })
  state.handlers['POST user/passkeys/verify'] = async (route) => {
    const body = route.request().postDataJSON()
    assert.equal(body.challengeId, 'registration')
    assert.ok(body.response.response.attestationObject)
    const key = { _id: String(++sequence).padStart(24, '0'), name: body.name, createdAt: '2026-01-02T10:00:00Z' }
    keys.push(key)
    state.handlers[`POST user/passkeys/${key._id}`] = async (rename) => {
      key.name = rename.request().postDataJSON().name
      await rename.fulfill({ json: { message: 'alerts.successSaving', result: key } })
    }
    state.handlers[`DELETE user/passkeys/${key._id}`] = async (remove) => {
      keys.splice(keys.indexOf(key), 1)
      await remove.fulfill({ json: { message: 'alerts.successDeleting' } })
    }
    await route.fulfill({ json: { message: 'alerts.successSaving', result: key } })
  }
  state.handlers['POST auth/passkey/options'] = (route) =>
    route.fulfill({
      json: { challengeId: 'authentication', optionsJSON: { challenge, rpId: new URL(origin).hostname, userVerification: 'required' } }
    })
  state.handlers['POST auth/passkey/verify'] = async (route) => {
    const body = route.request().postDataJSON()
    assert.equal(body.challengeId, 'authentication')
    assert.ok(body.response.response.signature)
    signedIn = true
    await route.fulfill({ status: 204 })
  }

  // Firefox has no virtual-authenticator protocol. Adapt only navigator.credentials;
  // the production component, browser library and HTTP flows remain real.
  await context.addInitScript(
    ({ adapt }) => {
      if (!navigator.credentials) return
      window.passkeyCancel = false
      const originalCreate = navigator.credentials.create.bind(navigator.credentials)
      const originalGet = navigator.credentials.get.bind(navigator.credentials)
      const credential = () => ({
        id: 'AQIDBA',
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
        type: 'public-key',
        getClientExtensionResults: () => ({ credProps: { rk: true } }),
        response: {
          attestationObject: new Uint8Array([1]).buffer,
          clientDataJSON: new Uint8Array([2]).buffer,
          authenticatorData: new Uint8Array([3]).buffer,
          signature: new Uint8Array([4]).buffer,
          userHandle: new Uint8Array([1, 2, 3, 4]).buffer,
          getTransports: () => ['internal']
        }
      })
      Object.defineProperty(navigator.credentials, 'create', {
        value: async (options) => {
          if (window.passkeyCancel) throw new DOMException('Cancelled', 'NotAllowedError')
          return adapt ? credential() : originalCreate(options)
        }
      })
      Object.defineProperty(navigator.credentials, 'get', {
        value: async (options) => {
          if (window.passkeyCancel) throw new DOMException('Cancelled', 'NotAllowedError')
          return adapt ? credential() : originalGet(options)
        }
      })
    },
    { adapt: browser.browserType().name() !== 'chromium' }
  )

  try {
    const page = await context.newPage()
    if (browser.browserType().name() === 'chromium') {
      const cdp = await context.newCDPSession(page)
      await cdp.send('WebAuthn.enable')
      await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true
        }
      })
    }
    await page.goto(`${origin}/user/settings`)
    let section = page.getByRole('region', { name: 'Passkeys', exact: true })
    await section.getByText('No passkeys added yet.').waitFor()
    const input = section.getByLabel('Passkey name', { exact: true })
    await input.fill('Laptop')
    await page.evaluate(() => {
      window.passkeyCancel = true
    })
    await section.getByRole('button', { name: 'Add passkey', exact: true }).click()
    await section.getByRole('button', { name: 'Add passkey', exact: true }).waitFor({ state: 'visible' })
    await page.waitForFunction(() => !document.querySelector('#new-passkey-name').disabled)
    assert.equal(keys.length, 0)
    await page.evaluate(() => {
      window.passkeyCancel = false
    })
    await section.getByRole('button', { name: 'Add passkey', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('section[aria-label="Passkeys"] li').length === 1)
    await section.locator('#new-passkey-name').fill('Security key')
    await section.getByRole('button', { name: 'Add passkey', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('section[aria-label="Passkeys"] li').length === 2)
    await section.locator('li').first().getByRole('textbox').fill('Home laptop')
    await section.locator('li').first().getByRole('button', { name: 'Save', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('#new-passkey-name').disabled)
    assert.equal(keys[0].name, 'Home laptop')
    await context.setOffline(true)
    await section.getByText('Passkeys can only be used and managed online.').waitFor()
    assert.equal(await section.getByRole('button', { name: 'Add passkey', exact: true }).isDisabled(), true)
    assert.equal(await section.locator('li').first().getByRole('button', { name: 'Delete', exact: true }).isDisabled(), true)
    await context.setOffline(false)
    enabled = false
    await page.reload()
    section = page.getByRole('region', { name: 'Passkeys', exact: true })
    await section.getByText('Passkey sign-in and registration are disabled by the administrator.').waitFor()
    assert.equal(await section.getByRole('button', { name: 'Add passkey', exact: true }).count(), 0)
    assert.equal(await section.locator('li').first().getByRole('textbox').inputValue(), 'Home laptop')
    page.once('dialog', (dialog) => dialog.accept())
    await section.locator('li').first().getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('section[aria-label="Passkeys"] li').length === 1)
    assert.equal(keys[0].name, 'Security key')
    enabled = true
    signedIn = false
    await page.goto(`${origin}/login?redirect=/user/settings`)
    const signIn = page.getByRole('button', { name: /Sign in with a passkey/ })
    await signIn.waitFor()
    await page.evaluate(() => {
      window.passkeyCancel = true
    })
    await signIn.click()
    await page.waitForFunction(
      () => ![...document.querySelectorAll('button')].find((button) => button.textContent.includes('Sign in with a passkey')).disabled
    )
    assert.equal(signedIn, false)
    await page.evaluate(() => {
      window.passkeyCancel = false
    })
    await signIn.click()
    await page.waitForURL(`${origin}/user/settings`)
    await page.getByRole('region', { name: 'Passkeys', exact: true }).waitFor()
    assert.equal(signedIn, true)
    console.log(`${browser.browserType().name()}: passkey registration, multiple keys, cancellation, management and login redirect`)
  } catch (error) {
    console.error('Passkey browser failure', {
      url: context.pages()[0]?.url(),
      body: await context.pages()[0]?.locator('body').textContent(),
      requests: state.requests.slice(-20)
    })
    throw error
  } finally {
    await fixture.close()
  }

  const unsupported = await browserFixture(browser)
  unsupported.state.handlers['GET displaySettings'] = state.handlers['GET displaySettings']
  await unsupported.context.addInitScript(() => {
    Object.defineProperty(window, 'PublicKeyCredential', { value: undefined })
  })
  try {
    const page = await unsupported.context.newPage()
    await page.goto(`${origin}/user/settings`)
    const section = page.getByRole('region', { name: 'Passkeys', exact: true })
    await section.getByText('Passkeys require a supported browser and a secure connection (HTTPS or localhost).').waitFor()
    assert.equal(await section.getByRole('button', { name: 'Add passkey', exact: true }).count(), 0)
  } finally {
    await unsupported.close()
  }
}
