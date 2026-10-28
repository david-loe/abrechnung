import assert from 'node:assert/strict'

export async function testWorkerLifecycle(browser, origin, currentEntry) {
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    let navigations = 0
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++
    })
    await page.goto(`${origin}/login?first-install=1#details`)
    await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated')
    await page.waitForFunction((entry) => [...document.scripts].some((script) => script.src === location.origin + entry), currentEntry)
    assert.equal(navigations, 1, 'First installation must not reload the document')
    assert.equal(page.url(), `${origin}/login?first-install=1#details`)
    console.log(`${browser.browserType().name()}: production worker first installation retains the document and URL`)
  } finally {
    await context.close()
  }
}
