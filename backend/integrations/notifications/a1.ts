import { TravelSimple } from 'abrechnung-common/types.js'
import { getDiffInDays, PlaceToString } from 'abrechnung-common/utils/scripts.js'
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
    `${t('labels.traveler')}: ${formatter.name(report.owner.name)}`,
    `${t('labels.reason')}: ${report.reason}`,
    `${t('labels.startDate')}: ${formatter.date(report.startDate, language)}`,
    `${t('labels.endDate')}: ${formatter.date(report.endDate, language)} (${dif} ${t(`labels.${dif === 1 ? 'day' : 'days'}`)})`,
    `${t('labels.destinationPlace')}: ${PlaceToString(report.destinationPlace, language)}`,
    `${t('labels.approvedBy')}: ${formatter.name(report.editor.name)}`,
    `${t('labels.destinationName')}: ${report.a1Certificate?.destinationName}`,
    `${t('labels.exactAddress')}: ${report.a1Certificate?.exactAddress}`
  ]

  if (report.fellowTravelersNames) {
    lastParagraph.splice(1, 0, `\n${t('labels.fellowTravelersNames')}: ${report.fellowTravelersNames}`)
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
