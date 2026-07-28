import test from 'ava'
import mongoose, { Types } from 'mongoose'
import { shutdown } from '../../app.js'
import Category from '../../models/category.js'
import LedgerAccount from '../../models/ledgerAccount.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'admin')

const categoryIds: Types.ObjectId[] = []
const reportIds: { collectionName: string; _id: Types.ObjectId }[] = []

async function createCategory(forType: 'Travel' | 'ExpenseReport' | 'both') {
  const ledgerAccount = await LedgerAccount.findOne().orFail()
  const category = await Category.create({
    name: `Scope test ${new Types.ObjectId()}`,
    ledgerAccount: ledgerAccount._id,
    for: forType,
    style: { color: '#D8DCFF', text: 'black' }
  })
  categoryIds.push(category._id)
  return category
}

async function insertReportReference(
  collectionName: 'travels' | 'expensereports' | 'healthcarecosts',
  categoryId: Types.ObjectId,
  location: 'expenses' | 'stages',
  historic = false
) {
  const _id = new Types.ObjectId()
  await mongoose.connection
    .collection(collectionName)
    .insertOne({ _id, historic, [location]: [{ cost: { positions: [{ category: categoryId }] } }] })
  reportIds.push({ collectionName, _id })
}

test.serial('category scope cannot become incompatible with active report positions', async (t) => {
  const cases = [
    { collectionName: 'travels' as const, location: 'expenses' as const, requestedFor: 'ExpenseReport' as const, bulk: true },
    { collectionName: 'travels' as const, location: 'stages' as const, requestedFor: 'ExpenseReport' as const },
    { collectionName: 'expensereports' as const, location: 'expenses' as const, requestedFor: 'Travel' as const },
    { collectionName: 'healthcarecosts' as const, location: 'expenses' as const, requestedFor: 'Travel' as const }
  ]

  for (const { collectionName, location, requestedFor, bulk } of cases) {
    const category = await createCategory('both')
    await insertReportReference(collectionName, category._id, location)

    const update = { _id: category._id.toString(), for: requestedFor }
    const response = await agent.post(bulk ? '/admin/category/bulk' : '/admin/category').send(bulk ? [update] : update)

    t.is(response.status, 422)
    t.true(response.body.errors.some((error: { path?: string; message: string }) => error.path === 'for' && error.message === 'referenced'))
    t.is((await Category.findById(category._id).orFail()).for, 'both')
  }
})

test.serial('category scope can be widened or changed when only historic reports reference it', async (t) => {
  const categoryToWiden = await createCategory('Travel')
  const widenedResponse = await agent.post('/admin/category').send({ _id: categoryToWiden._id.toString(), for: 'both' })
  t.is(widenedResponse.status, 200)
  t.is((await Category.findById(categoryToWiden._id).orFail()).for, 'both')

  const historicallyReferencedCategory = await createCategory('both')
  await insertReportReference('travels', historicallyReferencedCategory._id, 'stages', true)
  const restrictedResponse = await agent
    .post('/admin/category')
    .send({ _id: historicallyReferencedCategory._id.toString(), for: 'ExpenseReport' })
  t.is(restrictedResponse.status, 200)
  t.is((await Category.findById(historicallyReferencedCategory._id).orFail()).for, 'ExpenseReport')
})

test.serial.after.always('Clean up category scope tests and drop DB connection', async () => {
  await Promise.all(reportIds.map(({ collectionName, _id }) => mongoose.connection.collection(collectionName).deleteOne({ _id })))
  await Category.deleteMany({ _id: { $in: categoryIds } })
  await shutdown()
})
