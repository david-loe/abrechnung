import test from 'ava'
import { Types } from 'mongoose'
import { documentFileHandler } from '../helper.js'
import { getScopes } from '../mcp/auth.js'
import { createMcpServer, requestFor } from '../mcp/tools.js'
import User from '../models/user.js'

function createUser(access: Record<string, boolean>) {
  return new User({
    _id: new Types.ObjectId(),
    access: { user: true, ...access },
    projects: { assigned: [], supervised: [] },
    settings: { language: 'en' }
  })
}

function hasTool(server: ReturnType<typeof createMcpServer>, name: string) {
  return server.toolInputSchemaJson(name) !== undefined
}

function requiredFields(server: ReturnType<typeof createMcpServer>, name: string) {
  const required = server.toolInputSchemaJson(name)?.required
  return Array.isArray(required) ? required : []
}

test('normal MCP users receive only their own report creation tools', (t) => {
  const server = createMcpServer(
    createUser({ 'appliedFor:travel': true, 'approved:travel': true, 'appliedFor:advance': true, 'inWork:expenseReport': true })
  )

  t.true(hasTool(server, 'save_travel_application'))
  t.true(hasTool(server, 'save_own_approved_travel'))
  t.true(hasTool(server, 'save_advance_application'))
  t.true(hasTool(server, 'save_expense_report'))
  t.true(requiredFields(server, 'save_travel_application').includes('project'))
  t.true(requiredFields(server, 'save_advance_application').includes('project'))
  t.true(requiredFields(server, 'save_expense_report').includes('project'))
  t.false(hasTool(server, 'approve_travel'))
  t.false(hasTool(server, 'create_approved_advance_for_user'))
  t.false(hasTool(server, 'create_expense_report_for_user'))
  t.false(hasTool(server, 'list_users'))
})

test('special MCP tools follow the existing travel permissions', (t) => {
  const server = createMcpServer(createUser({ 'approve/travel': true, 'examine/travel': true, 'book/travel': true }))

  t.true(hasTool(server, 'approve_travel'))
  t.true(hasTool(server, 'reject_travel'))
  t.true(hasTool(server, 'create_approved_travel_for_user'))
  t.true(hasTool(server, 'update_report_for_user'))
  t.true(hasTool(server, 'create_travel_booking_export'))
  t.true(hasTool(server, 'list_users'))
  t.false(hasTool(server, 'approve_advance'))
  t.false(hasTool(server, 'create_expense_report_for_user'))
})

test('special MCP tools follow the existing advance and expense-report permissions', (t) => {
  const server = createMcpServer(
    createUser({ 'approve/advance': true, 'book/advance': true, 'examine/expenseReport': true, 'book/expenseReport': true })
  )

  t.true(hasTool(server, 'approve_advance'))
  t.true(hasTool(server, 'create_approved_advance_for_user'))
  t.true(hasTool(server, 'create_advance_booking_export'))
  t.true(hasTool(server, 'create_expense_report_for_user'))
  t.true(hasTool(server, 'create_expense_report_booking_export'))
  t.false(hasTool(server, 'approve_travel'))
})

test('MCP controller requests carry the item body used by receipt middleware', async (t) => {
  const user = createUser({})
  const body = { cost: { receipts: [] } }
  const request = requestFor(user, body)

  t.is(request.body, body)
  await t.notThrowsAsync(documentFileHandler(['cost', 'receipts'])(request))
})

test('MCP scopes support standard and Entra claim representations', (t) => {
  t.deepEqual(getScopes({ scope: 'openid  mcp' }), ['openid', 'mcp'])
  t.deepEqual(getScopes({ scp: 'openid\tmcp' }), ['openid', 'mcp'])
  t.deepEqual(getScopes({ scp: ['openid', 'mcp'] }), ['openid', 'mcp'])
  t.deepEqual(getScopes({ scp: ['mcp', 1] }), [])
})
