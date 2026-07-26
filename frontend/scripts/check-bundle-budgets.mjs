import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const outputDirectory = new URL('../dist/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', outputDirectory), 'utf8'))

const budgets = [
  { label: 'initial JavaScript', entry: /^index\.html$/, extension: '.js', raw: 725 * 1024, gzip: 225 * 1024 },
  { label: 'initial CSS', entry: /^index\.html$/, extension: '.css', raw: 360 * 1024, gzip: 54 * 1024, allowEmpty: true },
  { label: '/user lazy graph', file: /\/user-[^/]+\.js$/, raw: 305 * 1024, gzip: 96 * 1024 },
  { label: 'travel lazy graph', file: /\/travel-[^/]+\.js$/, raw: 205 * 1024, gzip: 66 * 1024 },
  { label: 'expense-report lazy graph', file: /\/expense-report-[^/]+\.js$/, raw: 159 * 1024, gzip: 56 * 1024 },
  { label: 'health-care-cost lazy graph', file: /\/health-care-cost-[^/]+\.js$/, raw: 157 * 1024, gzip: 55 * 1024 },
  { label: 'advance lazy graph', file: /\/advance-[^/]+\.js$/, raw: 59 * 1024, gzip: 21 * 1024 },
  // Vueform 1.13 currently sits just above the original estimate. Keep this
  // threshold close to the measured graph so regressions still fail CI.
  { label: 'admin/Vueform lazy graph', file: /\/admin-[^/]+\.js$/, raw: 4.62 * 1024 * 1024, gzip: 1.23 * 1024 * 1024 }
]

const recordsByFile = new Map(Object.values(manifest).map((record) => [record.file, record]))

function collectGraph(startFiles) {
  const files = new Set()
  const visit = (file) => {
    if (files.has(file)) return
    files.add(file)
    const record = recordsByFile.get(file)
    for (const importedKey of record?.imports ?? []) visit(manifest[importedKey].file)
    for (const cssFile of record?.css ?? []) files.add(cssFile)
  }
  for (const file of startFiles) visit(file)
  return files
}

async function sizes(files) {
  let raw = 0
  let gzip = 0
  for (const file of files) {
    const contents = await readFile(new URL(file, outputDirectory))
    raw += contents.byteLength
    gzip += gzipSync(contents).byteLength
  }
  return { raw, gzip }
}

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

let failed = false
const initialFiles = collectGraph([manifest['index.html'].file])
for (const budget of budgets) {
  const startFiles = Object.entries(manifest)
    .filter(([key, record]) => (budget.entry?.test(key) ?? false) || (budget.file?.test(record.file) ?? false))
    .map(([, record]) => record.file)
  if (startFiles.length === 0 && !budget.allowEmpty) throw new Error(`Could not locate the ${budget.label} bundle in the Vite manifest`)
  const graph = collectGraph(startFiles)
  if (!budget.entry) for (const initialFile of initialFiles) graph.delete(initialFile)
  const measured = await sizes(budget.extension ? [...graph].filter((file) => file.endsWith(budget.extension)) : graph)
  console.log(`${budget.label}: ${format(measured.raw)} raw / ${format(measured.gzip)} gzip`)
  if (measured.raw > budget.raw || measured.gzip > budget.gzip) {
    console.error(`  exceeds budget ${format(budget.raw)} raw / ${format(budget.gzip)} gzip`)
    failed = true
  }
}

const serviceWorker = await readFile(new URL('sw.js', outputDirectory), 'utf8')
const precachedFiles = [...serviceWorker.matchAll(/\{"revision":(?:null|"[^"]*"),"url":"([^"]+)"\}/g)].map((match) => match[1])
const existingPrecachedFiles = [...new Set(precachedFiles)].map((file) => file.replace(/^\//, ''))
const precacheSize = await sizes(existingPrecachedFiles)
console.log(`PWA precache: ${format(precacheSize.raw)} raw / ${format(precacheSize.gzip)} gzip`)
if (precacheSize.raw > 1520 * 1024 || precacheSize.gzip > 424 * 1024) {
  console.error('  exceeds budget 1520.0 KiB raw / 424.0 KiB gzip')
  failed = true
}

if (failed) process.exitCode = 1
