import { TravelSimple } from 'abrechnung-common/types.js'
import { getDiffInDays, placeToString } from 'abrechnung-common/utils/scripts.js'
import escapeHtml from 'escape-html'
import { BACKEND_CACHE } from '../../db.js'
import { formatter } from '../../factory.js'
import i18n from '../../i18n.js'
import Organisation from '../../models/organisation.js'
import { type IntegrationEvent, type IntegrationEventHandlerMap } from '../events.js'
import { Integration } from '../integration.js'
import { enqueueMail } from './email.js'

type ApprovedTravelEvent = Extract<IntegrationEvent, { type: 'travel.directly_approved' | 'travel.approved' }>

class A1NotificationIntegration extends Integration {
  private readonly notifyAboutApprovedTravel = async ({ report }: ApprovedTravelEvent) => {
    if (report.isCrossBorder && report.destinationPlace.country.needsA1Certificate) {
      await sendA1Notification(report)
    }
  }

  override readonly events: Partial<IntegrationEventHandlerMap> = {
    'travel.directly_approved': this.notifyAboutApprovedTravel,
    'travel.approved': this.notifyAboutApprovedTravel
  }

  constructor() {
    super('notifications.a1')
  }
}

export const a1NotificationIntegration = new A1NotificationIntegration()

function escapeNotificationValue(value: string | null | undefined) {
  return escapeHtml(value ?? '')
}

export async function sendA1Notification(report: TravelSimple) {
  const org = await Organisation.findOne({ _id: report.project.organisation })
  if (!org?.a1CertificateEmail) {
    return
  }

  const language = BACKEND_CACHE.displaySettings.locale.default
  const dif = getDiffInDays(report.startDate, report.endDate) + 1
  const t = (key: string) => i18n.t(key, { lng: language })
  const subject = t('mail.travel.a1.subject')
  const paragraph = t('mail.travel.a1.paragraph')
  const lastParagraph = [
    `${t('labels.traveler')}: ${escapeNotificationValue(formatter.name(report.owner.name))}`,
    `${t('labels.reason')}: ${escapeNotificationValue(report.reason)}`,
    `${t('labels.startDate')}: ${escapeNotificationValue(formatter.date(report.startDate))}`,
    `${t('labels.endDate')}: ${escapeNotificationValue(formatter.date(report.endDate))} (${dif} ${t(`labels.${dif === 1 ? 'day' : 'days'}`)})`,
    `${t('labels.destinationPlace')}: ${escapeNotificationValue(placeToString(report.destinationPlace, language))}`,
    `${t('labels.approvedBy')}: ${escapeNotificationValue(formatter.name(report.editor.name))}`
  ]

  if (report.fellowTravelersNames) {
    lastParagraph.splice(1, 0, `\n${t('labels.fellowTravelersNames')}: ${escapeNotificationValue(report.fellowTravelersNames)}`)
  }

  if (report.a1Certificate?.destinationName) {
    lastParagraph.push(`${t('labels.destinationName')}: ${escapeNotificationValue(report.a1Certificate.destinationName)}`)
  }

  if (report.a1Certificate?.exactAddress) {
    lastParagraph.push(`${t('labels.exactAddress')}: ${escapeNotificationValue(report.a1Certificate.exactAddress)}`)
  }

  await enqueueMail(
    [{ email: org.a1CertificateEmail, fk: {}, settings: { language }, name: { givenName: org.name, familyName: '' } }],
    subject,
    paragraph,
    undefined,
    lastParagraph,
    false
  )
}
