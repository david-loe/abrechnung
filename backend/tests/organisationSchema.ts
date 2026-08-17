import { travelExpenseItems } from 'abrechnung-common/types.js'
import test from 'ava'
import { Types } from 'mongoose'
import Organisation from '../models/organisation.js'

function organisation(includeBankBookings: boolean, withLedgerAccount: boolean) {
  const ledgerAccount = new Types.ObjectId()
  return new Organisation({
    name: 'Planet Express',
    accountingSettings: {
      employeeLiabilitiesAccount: ledgerAccount,
      employeeClaimsAccount: new Types.ObjectId(),
      currencyExchangeDifferencesAccount: new Types.ObjectId(),
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

test('payout accounts normalize bank data and accept an omitted BIC', async (t) => {
  const value = organisation(false, false)
  await value.validate()
  t.is(value.accountingSettings.payoutAccounts[0].iban, 'DE89370400440532013000')
  t.is(value.accountingSettings.payoutAccounts[0].bic, 'COBADEFF')

  const valueWithoutBic = organisation(false, false)
  valueWithoutBic.accountingSettings.payoutAccounts[0].bic = undefined
  await t.notThrowsAsync(valueWithoutBic.validate())
})

test('bank bookings require a ledger account for every payout account', async (t) => {
  await t.throwsAsync(organisation(true, false).validate(), { message: /missingBankLedgerAccount/ })
  await t.notThrowsAsync(organisation(true, true).validate())
})
