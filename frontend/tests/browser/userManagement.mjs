import assert from 'node:assert/strict'
import { browserFixture } from './fixture.mjs'

export async function testUserManagement(browser, origin) {
  const fixture = await browserFixture(browser)
  const { context } = fixture
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
    await fixture.close()
  }
}
