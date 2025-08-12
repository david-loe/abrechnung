import { _id, ApprovedTravel, Locale, Place } from 'abrechnung-common/types.js'
import pdf_lib from 'pdf-lib'
import { Column, PDFDrawer, Printer } from './printer.js'

export class ApprovedTravelsPrinter<idType extends _id> extends Printer<idType> {
  allowSpouseRefund?: boolean

  setAllowSpouseRefund(allowSpouseRefund: boolean) {
    this.allowSpouseRefund = allowSpouseRefund
  }

  async print(travels: ApprovedTravel[], language: Locale, from?: Date, to?: Date) {
    const drawer = await PDFDrawer.create(
      this.settings,
      this.getDocumentFileBufferById,
      this.getOrganisationLogoIdById,
      this.formatter,
      language,
      'landscape'
    )
    let y = drawer.currentPage.getSize().height
    await drawer.drawLogo(this.translateFunc('headlines.title', language), {
      fontSize: this.settings.fontSizes.L,
      xStart: this.settings.pagePadding / 3,
      yStart: y - this.settings.pagePadding / 3
    })

    y = y - drawer.settings.pagePadding - 24

    if (from && to) {
      const text = `${this.formatter.date(from, language)} - ${this.formatter.date(to, language)}`
      y = drawer.drawMultilineText(text, { xStart: drawer.settings.pagePadding, yStart: y, fontSize: this.settings.fontSizes.M })
    }

    const columns: Column<ApprovedTravel>[] = []

    let tableFontSize = this.settings.fontSizes.S
    const widths = {
      traveler: 100,
      startDate: 60,
      endDate: 60,
      destinationPlace: 150,
      reason: 150,
      appliedForOn: 60,
      approvedBy: 100,
      approvedOn: 60,
      fellowTravelersNames: 100
    }
    if (this.allowSpouseRefund) {
      tableFontSize *= 0.87
      for (const key of Object.keys(widths)) {
        widths[key as keyof typeof widths] *= 0.87
      }
    }
    columns.push({
      key: 'traveler',
      width: widths.traveler,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.translateFunc('labels.traveler', language)
    })
    columns.push({
      key: 'startDate',
      width: widths.startDate,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.translateFunc('labels.startDate', language),
      fn: (d: Date) => this.formatter.date(d)
    })
    columns.push({
      key: 'endDate',
      width: widths.endDate,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.translateFunc('labels.endDate', language),
      fn: (d: Date) => this.formatter.date(d)
    })
    columns.push({
      key: 'destinationPlace',
      width: widths.destinationPlace,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.translateFunc('labels.destinationPlace', language),
      fn: (p: Place) => `${p.place}, ${p.country.name[language]}`,
      countryCodeForFlag: (p: Place) => p.country._id
    })
    columns.push({ key: 'reason', width: 150, alignment: pdf_lib.TextAlignment.Left, title: this.translateFunc('labels.reason', language) })
    columns.push({
      key: 'appliedForOn',
      width: widths.appliedForOn,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.translateFunc('labels.appliedForOn', language),
      fn: (d: Date) => this.formatter.date(d)
    })
    columns.push({
      key: 'approvedBy',
      width: widths.approvedBy,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.translateFunc('labels.approvedBy', language)
    })
    columns.push({
      key: 'approvedOn',
      width: widths.approvedOn,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.translateFunc('labels.approvedOn', language),
      fn: (d: Date) => this.formatter.date(d)
    })
    if (this.allowSpouseRefund) {
      columns.push({
        key: 'fellowTravelersNames',
        width: widths.fellowTravelersNames,
        alignment: pdf_lib.TextAlignment.Left,
        title: this.translateFunc('labels.fellowTravelersNames', language)
      })
    }

    await drawer.drawTable(travels, columns, { xStart: drawer.settings.pagePadding, yStart: y, fontSize: tableFontSize })

    return await drawer.finish()
  }
}
