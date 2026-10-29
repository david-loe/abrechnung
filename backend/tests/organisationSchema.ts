import { travelExpenseItems } from 'abrechnung-common/types.js'
import test from 'ava'
import { Types } from 'mongoose'
import createAgent, { loginUser, shutdown } from './_agent.js'

const agent = await createAgent()
await loginUser(agent, 'admin')
const ledgerAccount = (await agent.get('/admin/ledgerAccount').expect(200)).body.data[0]._id

function organisation(includeBankBookings: boolean, withLedgerAccount: boolean, withBic = true) {
  return {
    name: `Bank account example ${new Types.ObjectId()}`,
    accountingSettings: {
      employeeLiabilitiesAccount: ledgerAccount,
      employeeClaimsAccount: ledgerAccount,
      currencyExchangeDifferencesAccount: ledgerAccount,
      accountMapping: Object.fromEntries(travelExpenseItems.map((item) => [item, ledgerAccount])),
      vatAccountingEnabled: false,
      vatRates: [{ rate: 0 }],
      includeBankBookings,
      payoutAccounts: [
        {
          name: 'Main',
          accountHolder: 'Planet Express',
          iban: 'de89 3704 0044 0532 0130 00',
          ...(withBic ? { bic: 'cobadeff' } : {}),
          ...(withLedgerAccount ? { ledgerAccount } : {})
        }
      ]
    }
  }
}

test.serial('given a payout account, HTTP save normalizes IBAN/BIC and accepts an omitted BIC', async (t) => {
  const response = await agent.post('/admin/organisation').send(organisation(false, false)).expect(200)
  const stored = await agent.get('/admin/organisation').query({ _id: response.body.result._id }).expect(200)
  t.is(stored.body.data.accountingSettings.payoutAccounts[0].iban, 'DE89370400440532013000')
  t.is(stored.body.data.accountingSettings.payoutAccounts[0].bic, 'COBADEFF')
  const without = await agent
    .post('/admin/organisation')
    .send(organisation(false, false, false))
    .expect(200)
  t.falsy(without.body.result.accountingSettings.payoutAccounts[0].bic)
})

test.serial('given bank bookings, HTTP save requires a ledger account for every payout account', async (t) => {
  const invalid = await agent.post('/admin/organisation').send(organisation(true, false))
  t.is(invalid.status, 422)
  t.regex(JSON.stringify(invalid.body), /missingBankLedgerAccount/)
  t.is((await agent.post('/admin/organisation').send(organisation(true, true))).status, 200)
})

test.after.always(async () => {
  await shutdown()
})
