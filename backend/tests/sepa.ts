import test from 'ava'
import { XMLParser } from 'fast-xml-parser'
import { createSepaDocument, SepaPayment } from '../controller/sepa.js'

const payment: SepaPayment = {
  key: 'ExpenseReport:report:organisation:owner:123.45',
  reportType: 'ExpenseReport',
  reference: 42,
  reportName: `Hotel & <Conference> ${'x'.repeat(180)}`,
  ownerId: '507f1f77bcf86cd799439011',
  creditorAccount: { accountHolder: 'Fry & Son', iban: 'DE89370400440532013000' },
  amount: 123.45
}

function document(executionDate = '2026-08-01', reversePayments = false) {
  const payments = [payment, { ...payment, key: `${payment.key}:2`, reference: 43, amount: 10.55 }]
  return createSepaDocument({
    debtorAccount: { accountHolder: 'Planet Express <Berlin>', iban: 'DE75512108001245126199', bic: 'SOGEDEFFXXX' },
    executionDate,
    payments: reversePayments ? payments.reverse() : payments
  })
}

test('creates parseable pain.001.001.09 with required totals and transactions', (t) => {
  const xml = document()
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(xml)
  const initiation = parsed.Document.CstmrCdtTrfInitn
  t.is(initiation.GrpHdr.NbOfTxs, 2)
  t.is(initiation.GrpHdr.CtrlSum, 134)
  t.is(initiation.PmtInf.PmtMtd, 'TRF')
  t.is(initiation.PmtInf.PmtTpInf.SvcLvl.Cd, 'SEPA')
  t.is(initiation.PmtInf.ReqdExctnDt.Dt, '2026-08-01')
  t.is(initiation.PmtInf.DbtrAcct.Id.IBAN, 'DE75512108001245126199')
  t.is(initiation.PmtInf.CdtTrfTxInf.length, 2)
  t.true(xml.includes('Fry &amp; Son'))
  t.true(xml.includes('Hotel &amp; &lt;Conference&gt;'))
  for (const transaction of initiation.PmtInf.CdtTrfTxInf) {
    t.true(transaction.PmtId.EndToEndId.length <= 35)
    t.true(transaction.RmtInf.Ustrd.length <= 140)
    t.false(transaction.PmtId.EndToEndId.includes('/'))
  }
})

test('payment identifiers are deterministic and independent from execution date', (t) => {
  const first = new XMLParser({ removeNSPrefix: true }).parse(document('2026-08-01')).Document.CstmrCdtTrfInitn
  const second = new XMLParser({ removeNSPrefix: true }).parse(document('2026-09-15', true)).Document.CstmrCdtTrfInitn
  t.is(first.GrpHdr.MsgId, second.GrpHdr.MsgId)
  t.is(first.PmtInf.PmtInfId, second.PmtInf.PmtInfId)
  t.deepEqual(
    first.PmtInf.CdtTrfTxInf.map((transaction: { PmtId: { EndToEndId: string } }) => transaction.PmtId.EndToEndId),
    second.PmtInf.CdtTrfTxInf.map((transaction: { PmtId: { EndToEndId: string } }) => transaction.PmtId.EndToEndId)
  )
})
