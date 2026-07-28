import { createHash } from 'node:crypto'
import { BankAccount, ReportModelName } from 'abrechnung-common/types.js'
import { refNumberToString, roundAmount } from 'abrechnung-common/utils/scripts.js'

export interface SepaPayment {
  key: string
  reportType: ReportModelName
  reference: number
  reportName: string
  ownerId: string
  creditorAccount: BankAccount
  amount: number
}

interface SepaDocumentOptions {
  debtorAccount: BankAccount
  executionDate: string
  payments: SepaPayment[]
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
}

function xml(value: string | number) {
  return String(value).replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }
    return entities[character]
  })
}

function text(value: string, maximumLength: number) {
  return Array.from(value.normalize('NFC')).slice(0, maximumLength).join('')
}

function amount(value: number) {
  return roundAmount(value).toFixed(2)
}

function agent(bic?: string | null) {
  return bic ? `<FinInstnId><BICFI>${xml(bic)}</BICFI></FinInstnId>` : '<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>'
}

export function createEndToEndId(payment: Pick<SepaPayment, 'reference' | 'reportType' | 'ownerId'>) {
  const reference = refNumberToString(payment.reference, payment.reportType).replace(/[^A-Za-z0-9-]/g, '')
  return `E2E-${reference}-${hash(payment.ownerId).slice(0, 18)}`.slice(0, 35)
}

export function createSepaDocument(options: SepaDocumentOptions) {
  const payments = [...options.payments].sort((left, right) => left.key.localeCompare(right.key))
  const paymentHash = hash(payments.map(({ key }) => key).join('\n'))
  const messageId = `MSG-${paymentHash.slice(0, 31)}`
  const paymentInformationId = `PMT-${paymentHash.slice(0, 31)}`
  const controlSum = amount(payments.reduce((sum, payment) => sum + payment.amount, 0))
  const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  const transactions = payments
    .map((payment) => {
      const purpose = text(`${refNumberToString(payment.reference, payment.reportType)} ${payment.reportName}`.trim(), 140)
      const creditorAgent = payment.creditorAccount.bic ? `<CdtrAgt>${agent(payment.creditorAccount.bic)}</CdtrAgt>` : ''
      return `<CdtTrfTxInf><PmtId><EndToEndId>${createEndToEndId(payment)}</EndToEndId></PmtId><Amt><InstdAmt Ccy="EUR">${amount(
        payment.amount
      )}</InstdAmt></Amt>${creditorAgent}<Cdtr><Nm>${xml(text(payment.creditorAccount.accountHolder, 70))}</Nm></Cdtr><CdtrAcct><Id><IBAN>${xml(
        payment.creditorAccount.iban
      )}</IBAN></Id></CdtrAcct><RmtInf><Ustrd>${xml(purpose)}</Ustrd></RmtInf></CdtTrfTxInf>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"><CstmrCdtTrfInitn><GrpHdr><MsgId>${messageId}</MsgId><CreDtTm>${createdAt}</CreDtTm><NbOfTxs>${payments.length}</NbOfTxs><CtrlSum>${controlSum}</CtrlSum><InitgPty><Nm>${xml(
    text(options.debtorAccount.accountHolder, 70)
  )}</Nm></InitgPty></GrpHdr><PmtInf><PmtInfId>${paymentInformationId}</PmtInfId><PmtMtd>TRF</PmtMtd><BtchBookg>true</BtchBookg><NbOfTxs>${
    payments.length
  }</NbOfTxs><CtrlSum>${controlSum}</CtrlSum><PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf><ReqdExctnDt><Dt>${xml(
    options.executionDate
  )}</Dt></ReqdExctnDt><Dbtr><Nm>${xml(text(options.debtorAccount.accountHolder, 70))}</Nm></Dbtr><DbtrAcct><Id><IBAN>${xml(
    options.debtorAccount.iban
  )}</IBAN></Id></DbtrAcct><DbtrAgt>${agent(options.debtorAccount.bic)}</DbtrAgt><ChrgBr>SLEV</ChrgBr>${transactions}</PmtInf></CstmrCdtTrfInitn></Document>`
}
