import assert from 'node:assert/strict'
import { browserFixture } from './fixture.mjs'

export async function testInteractions(browser, origin) {
  // Given categories, filtering is a user interaction and must not submit a form or sort the table.
  {
    const fixture = await browserFixture(browser)
    try {
      const page = await fixture.context.newPage()
      await page.goto(`${origin}/admin/categories`)
      await page
        .getByRole('row')
        .filter({ has: page.getByRole('cell', { name: 'Meals', exact: true }) })
        .waitFor()
      const filter = page.getByRole('button', { name: 'Filter', exact: true })
      assert.equal(await filter.getAttribute('aria-expanded'), 'false')
      await filter.click()
      assert.equal(await filter.getAttribute('aria-expanded'), 'true')
      const input = page.getByRole('columnheader', { name: /Name/ }).getByRole('textbox')
      await input.click()
      await input.fill('Meals')
      await page
        .getByRole('row')
        .filter({ has: page.getByRole('cell', { name: 'Travel', exact: true }) })
        .waitFor({ state: 'hidden' })
      await page
        .getByRole('row')
        .filter({ has: page.getByRole('cell', { name: 'Meals', exact: true }) })
        .waitFor()
      assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).count(), 0)
      await filter.click()
      await page
        .getByRole('row')
        .filter({ has: page.getByRole('cell', { name: 'Travel', exact: true }) })
        .waitFor()
      assert.equal(await input.count(), 0)
      console.log(`${browser.browserType().name()}: category filtering through real controls`)
    } finally {
      await fixture.close()
    }
  }
  // Given an administrator, repeated API-key cancellation closes the real Bootstrap modal.
  {
    const fixture = await browserFixture(browser)
    try {
      const page = await fixture.context.newPage()
      await page.goto(`${origin}/admin/categories`)
      await page.getByRole('cell', { name: 'Meals', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Users', exact: true }).click()
      await page
        .getByRole('row', { name: /Ada Lovelace/ })
        .getByRole('button')
        .first()
        .click()
      await page.getByText('Login & Access', { exact: true }).click()
      for (let index = 0; index < 2; index++) {
        await page.getByRole('button', { name: 'Gen API Key', exact: true }).click()
        const dialog = page.getByRole('dialog')
        await dialog.waitFor()
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        await dialog.waitFor({ state: 'hidden' })
      }
      // Browser Back unmounts the component even while its modal is opening.
      await page.getByRole('button', { name: 'Gen API Key', exact: true }).click()
      await page.goBack()
      await page.getByRole('cell', { name: 'Meals', exact: true }).waitFor()
      const filter = page.getByRole('button', { name: 'Filter', exact: true })
      await filter.click()
      assert.equal(await filter.getAttribute('aria-expanded'), 'true')
      await page.getByRole('columnheader', { name: /Name/ }).getByRole('textbox').fill('Meals')
      await page.getByRole('cell', { name: 'Travel', exact: true }).waitFor({ state: 'hidden' })
      console.log(`${browser.browserType().name()}: modal cancellation, reopening and disposal`)
    } finally {
      await fixture.close()
    }
  }
  // Given a saved image, Enter and Space open it; Space on the child Delete button deletes it.
  {
    const fixture = await browserFixture(browser)
    try {
      const page = await fixture.context.newPage()
      await page.goto(`${origin}/user/settings`)
      const card = page.getByRole('button').filter({ hasText: 'Registration.png' })
      await card.waitFor()
      for (const key of ['Enter', 'Space']) {
        await card.focus()
        const opened = page.waitForEvent('popup')
        await page.keyboard.press(key)
        const preview = await opened
        await preview.waitForLoadState()
        assert.ok(preview.url().startsWith('blob:'))
        await preview.close()
      }
      page.once('dialog', (dialog) => dialog.accept())
      await card.getByTitle('Delete', { exact: true }).focus()
      await page.keyboard.press('Space')
      await card.waitFor({ state: 'hidden' })
      assert.equal(fixture.context.pages().length, 1)
      console.log(`${browser.browserType().name()}: file keyboard access and isolated child actions`)
    } finally {
      await fixture.close()
    }
  }
}
