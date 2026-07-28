import { travelExpenseItems } from 'abrechnung-common/types.js'
import test from 'ava'
import { Types } from 'mongoose'
import Organisation, { organisationSchema } from '../models/organisation.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'

function organisation(includeBankBookings: boolean, withLedgerAccount: boolean) {
  const ledgerAccount = new Types.ObjectId()
  return new Organisation({
    name: 'Planet Express',
    accountingSettings: {
      employeeLiabilitiesAccount: ledgerAccount,
      employeeClaimsAccount: new Types.ObjectId(),
      accountMapping: Object.fromEntries(travelExpenseItems.map((item) => [item, new Types.ObjectId()])),
      vatAccountingEnabled: false,
      vatRates: [{ rate: 0 }],
      includeBankBookings,
      payoutAccounts: [
        {
          name: 'Main',
          accountHolder: 'Planet Express',
          iban: 'de89 3704 0044 0532 0130 00',
          bic: 'cobadeff',
          ...(withLedgerAccount ? { ledgerAccount } : {})
        }
      ]
    }
  })
}

test('organisation schema normalizes bank data and accepts optional BIC', async (t) => {
  const value = organisation(false, false)
  await value.validate()
  t.is(value.accountingSettings.payoutAccounts[0].iban, 'DE89370400440532013000')
  t.is(value.accountingSettings.payoutAccounts[0].bic, 'COBADEFF')
})

test('organisation schema requires bank ledger accounts only when bank bookings are enabled', async (t) => {
  await t.throwsAsync(organisation(true, false).validate(), { message: /missingBankLedgerAccount/ })
  await t.notThrowsAsync(organisation(true, true).validate())
})

test('Vueform schema keeps VAT and payout account list object elements visible', (t) => {
  const schema = mongooseSchemaToVueformSchema(organisationSchema().obj, 'en')
  const accountingSettings = schema.accountingSettings.schema
  t.is(accountingSettings.vatRates.type, 'list')
  t.truthy(accountingSettings.vatRates.object.schema.rate)
  t.is(accountingSettings.payoutAccounts.type, 'list')
  t.truthy(accountingSettings.payoutAccounts.object.schema.iban)
  t.truthy(accountingSettings.payoutAccounts.object.schema.ledgerAccount)
})
