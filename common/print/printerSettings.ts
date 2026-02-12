export default {
  fontName: 'Inter',
  fontSizes: { S: 9, M: 11, L: 16 },
  textColor: '#000',
  pagePadding: 30,
  borderColor: '#000',
  borderThickness: 1,
  cellPadding: { x: 2, bottom: 4 },
  pageSize: { width: 595.28, height: 841.89 },
  options: {
    travel: {
      reviewDates: true,
      metaInformation: true,
      project: true,
      comments: true,
      notes: true,
      bookingRemark: true,
      additionalOwnerDetails: true
    },
    expenseReport: {
      reviewDates: true,
      metaInformation: true,
      project: true,
      comments: true,
      notes: true,
      bookingRemark: true,
      additionalOwnerDetails: true
    },
    healthCareCost: {
      reviewDates: true,
      metaInformation: true,
      project: true,
      comments: true,
      notes: true,
      bookingRemark: true,
      additionalOwnerDetails: true
    },
    advance: {
      reviewDates: true,
      metaInformation: true,
      project: true,
      comments: true,
      notes: true,
      bookingRemark: true,
      additionalOwnerDetails: true
    }
  }
} as const
