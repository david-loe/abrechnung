import { Category, ExpenseReport, ExpenseReportState, ProjectSimple } from 'abrechnung-common/types.js'
import test from 'ava'
import { Types } from 'mongoose'
import { objectToFormFields } from '../../helper.js'
import CategoryModel from '../../models/category.js'
import DocumentFile from '../../models/documentFile.js'
import ExpenseReportModel from '../../models/expenseReport.js'
import LedgerAccount from '../../models/ledgerAccount.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
const reportIds: Types.ObjectId[] = []
const categories: Category<Types.ObjectId>[] = []
let project: ProjectSimple<string>

async function createReport(category?: Category<Types.ObjectId> | null) {
  const response = await agent.post('/expenseReport/inWork').send({ name: 'Category test', project, category })
  if (response.status !== 200) throw new Error(JSON.stringify(response.body))
  reportIds.push(new Types.ObjectId(response.body.result._id))
  return response.body.result as ExpenseReport<string>
}

function cost(categoryIds: (Types.ObjectId | undefined)[]) {
  return {
    currency: 'EUR',
    date: '2026-01-01',
    positions: categoryIds.map((category, index) => ({
      kind: 'manual',
      description: `Position ${index}`,
      grossAmount: 10,
      vatRate: 0,
      project: project._id,
      category
    }))
  }
}

async function addExpense(reportId: string, categoryIds: (Types.ObjectId | undefined)[]) {
  return agent
    .post('/expenseReport/expense/bulk')
    .query({ parentId: reportId })
    .send([{ description: 'Category expense', cost: cost(categoryIds) }])
}

async function postExpense(endpoint: string, reportId: string, expense: unknown) {
  let request = agent.post(`${endpoint}expenseReport/expense`).query({ parentId: reportId })
  for (const entry of objectToFormFields(JSON.parse(JSON.stringify(expense)))) {
    request = entry.field.endsWith('[data]') ? request.attach(entry.field, entry.val) : request.field(entry.field, entry.val)
  }
  return await request
}

function positionCategories(report: ExpenseReport<string>) {
  return report.expenses.flatMap(({ cost }) => cost.positions.map(({ category }) => category._id.toString()))
}

async function createCategory(forType: Category['for']) {
  const ledgerAccount = await LedgerAccount.findOne().orFail()
  const category = await CategoryModel.create({
    name: `Category test ${new Types.ObjectId()}`,
    ledgerAccount: ledgerAccount._id,
    for: forType,
    style: { color: '#336699', text: 'white' }
  })
  categories.push(category)
  return category
}

test.before(async () => {
  await loginUser(agent, 'user')
  project = (await agent.get('/project')).body.data[0]
  for (const forType of ['ExpenseReport', 'both', 'ExpenseReport', 'Travel'] as const) {
    await createCategory(forType)
  }
})

test.serial('report category is populated without replacing explicit position categories', async (t) => {
  const [a, b, c] = categories
  const report = await createReport(a)
  t.is(report.category?._id, a._id.toString())
  t.is(report.category?.style.color, a.style.color)
  t.is(report.category?.style.text, a.style.text)
  t.is((await addExpense(report._id, [a._id, c._id])).status, 200)
  t.is((await addExpense(report._id, [a._id])).status, 200)

  const response = await agent.post('/expenseReport/inWork').send({ _id: report._id, category: b._id })
  t.is(response.status, 200)
  t.deepEqual(positionCategories(response.body.result), [a._id.toString(), c._id.toString(), a._id.toString()])
  const fetched = await agent.get('/expenseReport').query({ _id: report._id })
  t.is(fetched.body.data.category._id, b._id.toString())

  const cleared = await agent.post('/expenseReport/inWork').send({ _id: report._id, category: null })
  t.is(cleared.status, 200)
  t.is(cleared.body.result.category, null)
  t.deepEqual(positionCategories(cleared.body.result), positionCategories(response.body.result))
  const firstSet = await agent.post('/expenseReport/inWork').send({ _id: report._id, category: a._id })
  t.is(firstSet.status, 200)
  t.deepEqual(positionCategories(firstSet.body.result), positionCategories(response.body.result))
})

test.serial('multipart expenses preserve explicit position categories', async (t) => {
  const [a, , c] = categories
  const report = await createReport(a)
  const request = agent
    .post('/expenseReport/expense')
    .query({ parentId: report._id })
    .field('description', 'Multipart category expense')
    .field('cost[currency]', 'EUR')
    .field('cost[date]', '2026-01-01')
  for (const [index, position] of cost([a._id, c._id]).positions.entries()) {
    for (const [key, value] of Object.entries(position)) {
      if (value !== undefined) request.field(`cost[positions][${index}][${key}]`, value.toString())
    }
  }
  const response = await request
  t.is(response.status, 200)
  t.deepEqual(positionCategories(response.body.result), [a._id.toString(), c._id.toString()])
})

for (const role of ['user', 'expenseReport'] as const) {
  test.serial(`${role} can save replacement positions through the existing expense endpoint without losing receipts`, async (t) => {
    const [a, b, c] = categories
    const report = await createReport(a)
    const added = await postExpense('/', report._id, {
      description: 'Expense with receipt',
      note: 'Preserve note',
      cost: { ...cost([a._id, c._id]), receipts: [{ name: 'Receipt.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }] }
    })
    t.is(added.status, 200)
    const expense = added.body.result.expenses[0] as ExpenseReport<string>['expenses'][number]
    t.is(expense.cost.receipts.length, 1)
    const positions = expense.cost.positions.map((position) =>
      position.category._id === a._id.toString() ? { ...position, category: b } : position
    )
    const prefix = role === 'user' ? '/' : '/examine/'
    try {
      await loginUser(agent, role)
      const saved = await postExpense(prefix, report._id, { ...expense, cost: { ...expense.cost, positions } })
      t.is(saved.status, 200)
      const savedExpense = saved.body.result.expenses[0] as ExpenseReport<string>['expenses'][number]
      const { cost: savedCost, ...savedDetails } = savedExpense
      const { cost: originalCost, ...originalDetails } = expense
      t.deepEqual(savedDetails, originalDetails)
      t.deepEqual(savedCost.receipts, originalCost.receipts)
      t.deepEqual(savedCost.currency, originalCost.currency)
      t.is(savedCost.date, originalCost.date)
      t.deepEqual(positionCategories(saved.body.result), [b._id.toString(), c._id.toString()])
      t.deepEqual(
        savedCost.positions.map(({ category: _category, project, ...position }) => ({ ...position, project: project._id })),
        originalCost.positions.map(({ category: _category, project, ...position }) => ({ ...position, project: project._id }))
      )
      const details = await agent
        .post(`${prefix}expenseReport${role === 'user' ? '/inWork' : ''}`)
        .send({ _id: report._id, category: b._id })
      t.is(details.status, 200)
      t.is(details.body.result.category._id, b._id.toString())
      t.deepEqual(positionCategories(details.body.result), [b._id.toString(), c._id.toString()])
    } finally {
      await loginUser(agent, 'user')
    }
  })
}

test.serial('cost positions require valid explicit categories even when the report has a category', async (t) => {
  const [a, , , travelCategory] = categories
  const report = await createReport(a)
  t.is((await addExpense(report._id, [a._id])).status, 200)
  const withoutCategory = await createReport()
  t.is((await addExpense(withoutCategory._id, [undefined])).status, 422)
  t.is((await addExpense(report._id, [undefined])).status, 422)
  t.is((await postExpense('/', report._id, { description: 'Missing category', cost: cost([undefined]) })).status, 422)
  for (const category of [travelCategory._id, new Types.ObjectId()]) {
    t.is((await addExpense(report._id, [category])).status, 422)
  }
  t.deepEqual(
    positionCategories((await agent.get('/expenseReport').query({ _id: report._id, additionalFields: ['expenses'] })).body.data),
    [a._id.toString()]
  )
})

test.serial('examiner can change the report category without replacing positions and other users cannot edit', async (t) => {
  const [a, b] = categories
  const report = await createReport(a)
  await addExpense(report._id, [a._id])
  await loginUser(agent, 'admin')
  t.is((await agent.post('/expenseReport/inWork').send({ _id: report._id, category: b._id })).status, 403)
  await loginUser(agent, 'expenseReport')
  const response = await agent.post('/examine/expenseReport').send({ _id: report._id, category: b._id })
  t.is(response.status, 200)
  t.is(response.body.result.category._id, b._id.toString())
  t.deepEqual(positionCategories(response.body.result), [a._id.toString()])
  await loginUser(agent, 'user')
})

test.serial('reopening a report preserves the previous category in history', async (t) => {
  const [a, b] = categories
  const report = await createReport(a)
  await addExpense(report._id, [a._id])
  await ExpenseReportModel.updateOne({ _id: report._id }, { $set: { state: ExpenseReportState.IN_REVIEW } })
  const response = await agent.post('/expenseReport/inWork').send({ _id: report._id, category: b._id })
  t.is(response.status, 200)
  t.is(response.body.result.category._id, b._id.toString())
  t.deepEqual(positionCategories(response.body.result), [a._id.toString()])
  const historic = await ExpenseReportModel.findById(response.body.result.history.at(-1)).lean().orFail()
  t.is(historic.category?._id.toString(), a._id.toString())
  t.deepEqual(positionCategories(historic as unknown as ExpenseReport<string>), [a._id.toString()])
})

test.serial('a category referenced only by an empty report cannot be deleted or restricted to travel', async (t) => {
  const b = await createCategory('both')
  await createReport(b)
  await loginUser(agent, 'admin')
  t.is((await agent.delete('/admin/category').query({ _id: b._id.toString() })).status, 409)
  t.is((await agent.post('/admin/category').send({ _id: b._id, for: 'Travel' })).status, 422)
  await loginUser(agent, 'user')
})

test.after.always(async () => {
  const reports = await ExpenseReportModel.find({ _id: { $in: reportIds } })
    .select({ history: 1, 'expenses.cost.receipts': 1 })
    .lean()
  await ExpenseReportModel.deleteMany({ _id: { $in: [...reportIds, ...reports.flatMap(({ history }) => history)] } })
  await DocumentFile.deleteMany({
    _id: { $in: reports.flatMap(({ expenses }) => expenses.flatMap(({ cost }) => cost.receipts.map(({ _id }) => _id))) }
  })
  await CategoryModel.deleteMany({ _id: { $in: categories.map(({ _id }) => _id) } })
  await shutdown()
})
