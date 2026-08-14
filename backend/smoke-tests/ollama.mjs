import assert from 'node:assert/strict'

const baseUrl = (process.env.OLLAMA_SMOKE_BASE_URL ?? 'http://ollama:11434/v1').replace(/\/+$/, '')
const model = process.env.OLLAMA_SMOKE_MODEL ?? 'qwen3:0.6b'
const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { const: 'expense' },
    description: { type: ['string', 'null'] },
    cost: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        date: { type: ['string', 'null'] },
        currencyCode: { type: ['string', 'null'], enum: ['EUR', null] },
        positions: {
          type: ['array', 'null'],
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              description: { type: ['string', 'null'] },
              grossAmount: { type: 'number' },
              vatRate: { type: 'number', enum: [19] },
              categoryId: { type: ['string', 'null'], enum: ['drinks', 'meals', null] }
            },
            required: ['description', 'grossAmount', 'vatRate', 'categoryId']
          }
        }
      },
      required: ['date', 'currencyCode', 'positions']
    }
  },
  required: ['type', 'description', 'cost']
}

const response = await fetch(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ollama', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    temperature: 0,
    reasoning_effort: 'none',
    messages: [
      {
        role: 'system',
        content:
          'Extract the receipt. Create one cost position per receipt line. Multiple positions may use the same VAT rate. Every property required by the response schema must be present, including when null. Return only compact JSON matching the response schema.'
      },
      {
        role: 'user',
        content: JSON.stringify({
          candidates: {
            categories: [
              { _id: 'drinks', name: 'Drinks' },
              { _id: 'meals', name: 'Meals' }
            ],
            currencyCodes: ['EUR'],
            vatRates: [19]
          },
          documents: [
            {
              name: 'receipt.pdf',
              text: 'Receipt dated 2026-07-24. Coffee, category Drinks, gross 3.50 EUR including 19% VAT. Sandwich, category Meals, gross 6.50 EUR including 19% VAT. Total 10.00 EUR.'
            }
          ]
        })
      }
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'receipt_suggestion_smoke', strict: true, schema } }
  }),
  signal: AbortSignal.timeout(180_000)
})

if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}: ${(await response.text()).slice(0, 1_000)}`)

const payload = await response.json()
const content = payload?.choices?.[0]?.message?.content
assert.equal(typeof content, 'string', 'Ollama response contains no assistant content')
const suggestion = JSON.parse(content)
assert.equal(suggestion.type, 'expense')
assert.equal(suggestion.cost?.currencyCode, 'EUR')
assert.deepEqual(
  suggestion.cost?.positions?.map(({ grossAmount }) => grossAmount).sort((left, right) => left - right),
  [3.5, 6.5]
)
assert.deepEqual(
  suggestion.cost?.positions?.map(({ vatRate }) => vatRate),
  [19, 19]
)
console.info(`Ollama smoke test passed with ${model}.`)
