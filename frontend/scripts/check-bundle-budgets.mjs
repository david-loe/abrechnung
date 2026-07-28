import { glob, readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const outputDirectory = new URL('../dist/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', outputDirectory), 'utf8'))
const maximumGzipSize = 1024 * 1024

function findImportCycle() {
  const visited = new Set()
  const active = new Set()
  const path = []

  function visit(key) {
    if (active.has(key)) return [...path.slice(path.indexOf(key)), key]
    if (visited.has(key)) return undefined
    active.add(key)
    path.push(key)
    for (const dependency of manifest[key].imports ?? []) {
      const cycle = visit(dependency)
      if (cycle) return cycle
    }
    path.pop()
    active.delete(key)
    visited.add(key)
  }

  for (const key of Object.keys(manifest)) {
    const cycle = visit(key)
    if (cycle) return cycle
  }
}

const importCycle = findImportCycle()
if (importCycle) throw new Error(`Circular bundle imports: ${importCycle.join(' -> ')}`)

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

const bundles = []
for await (const file of glob('**/*.{js,css}', { cwd: outputDirectory })) {
  const contents = await readFile(new URL(file, outputDirectory))
  bundles.push({ file, gzipSize: gzipSync(contents).byteLength })
}

bundles.sort((left, right) => right.gzipSize - left.gzipSize)
const largestBundle = bundles[0]
if (largestBundle) console.log(`Largest bundle: ${largestBundle.file} (${format(largestBundle.gzipSize)} gzip)`)

let failed = false
for (const bundle of bundles) {
  if (bundle.gzipSize > maximumGzipSize) {
    console.error(`${bundle.file}: ${format(bundle.gzipSize)} gzip exceeds bundle limit ${format(maximumGzipSize)}`)
    failed = true
  }
}

if (failed) process.exitCode = 1
