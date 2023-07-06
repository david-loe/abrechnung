function getFlagEmoji(countryCode) {
  const noFlag = ['XCD', 'XOF', 'XAF', 'ANG', 'XPF']
  if (noFlag.indexOf(countryCode) !== -1) {
    return null
  }
  const codePoints = countryCode
    .slice(0, 2)
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

function datetimeToDateString(datetime) {
  return new Date(datetime).toISOString().slice(0, -14)
}

function datetimeToDate(datetime) {
  return new Date(datetimeToDateString(datetime))
}

function getDiffInDays(startDate, endDate) {
  const firstDay = datetimeToDate(startDate)
  const lastDay = datetimeToDate(endDate)
  return ((lastDay.valueOf() - firstDay.valueOf()) / (1000 * 60 * 60 * 24))
}

function getDayList(startDate, endDate) {
  const days = []
  for (var i = 0; i < getDiffInDays(startDate, endDate) + 1; i++) {
    days.push(new Date(datetimeToDate(startDate).valueOf() + i * 1000 * 60 * 60 * 24))
  }
  return days
}

function getMoneyString(money, useExchangeRate = true, func = (x) => x, locale) {
  return (func(((useExchangeRate && money.exchangeRate) ? money.exchangeRate.amount : money.amount))).toLocaleString(locale, {
    style: "currency",
    currency: (useExchangeRate && money.exchangeRate) ? "EUR" : (money.currency._id ? money.currency._id : money.currency) // baseCurrency
  })
}

function getDetailedMoneyString(money, locale, printZero = false) {
  if (!money || money && (typeof money.amount !== 'number' || !money.amount && !printZero)) {
    return ''
  }
  string = money.amount.toLocaleString(locale, {
    style: "currency",
    currency: (money.currency._id ? money.currency._id : money.currency)
  })
  if (money.exchangeRate && money.exchangeRate.rate) {
    string = string + ' * ' + money.exchangeRate.rate.toLocaleString(locale, { maximumFractionDigits: 4 }) + ' = '
    string = string + money.exchangeRate.amount.toLocaleString(locale, {
      style: "currency",
      currency: "EUR" // baseCurrency
    })
  }
  return string
}

function placeToString(place, locale = 'de') {
  return place.place + ', ' + place.country.name[locale] + place.country.flag
}


function dateToTimeString(date) {
  if (!date) return ''
  const dateObject = new Date(date)
  const hour = dateObject.getUTCHours().toString().padStart(2, '0')
  const minute = dateObject.getUTCMinutes().toString().padStart(2, '0')
  return hour + ':' + minute
}

function datetoDateString(date) {
  if (!date) return ''
  const dateObject = new Date(date)
  const month = (dateObject.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = dateObject.getUTCDate().toString().padStart(2, '0')
  return day + '.' + month
}

function dateTimeToString(datetime) {
  return datetoDateString(datetime) + ' ' + dateToTimeString(datetime)
}

function datetoDateStringWithYear(date) {
  if (!date) return ''
  const dateObject = new Date(date)
  const year = (dateObject.getUTCFullYear()).toString()
  const month = (dateObject.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = dateObject.getUTCDate().toString().padStart(2, '0')
  return day + '.' + month + '.' + year
}

function getLumpSumsSum(travel) {
  var sum = 0
  for (const day of travel.days) {
    for (const refund of day.refunds) {
      sum += refund.refund.amount
    }
  }
  // baseCurrency
  return { amount: sum, currency: { _id: "EUR" } }
}

function getExpensesSum(travel) {
  var sum = 0
  for (const stage of travel.stages) {
    if (stage.cost && stage.cost.amount > 0) {
      if (stage.cost.exchangeRate && typeof stage.cost.exchangeRate.amount == 'number') {
        sum += stage.cost.exchangeRate.amount
      } else {
        sum += stage.cost.amount
      }
    }
  }
  for (const expense of travel.expenses) {
    if (expense.cost && expense.cost.amount > 0) {
      if (expense.cost.exchangeRate && typeof expense.cost.exchangeRate.amount == 'number') {
        sum += expense.cost.exchangeRate.amount
      } else {
        sum += expense.cost.amount
      }
    }
  }
  // baseCurrency
  return { amount: sum, currency: { _id: "EUR" } }
}

function getTravelTotal(travel) {
  var advance = 0
  if (travel.advance && travel.advance.amount) {
    advance = travel.advance.exchangeRate ? travel.advance.exchangeRate.amount : travel.advance.amount
  }
  // baseCurrency
  return { amount: getExpensesSum(travel).amount + getLumpSumsSum(travel).amount - advance, currency: { _id: "EUR" } }
}

module.exports = {
  getFlagEmoji,
  getDiffInDays,
  getDayList,
  datetimeToDateString,
  getMoneyString,
  getDetailedMoneyString,
  placeToString,
  dateTimeToString,
  dateToTimeString,
  datetoDateString,
  datetoDateStringWithYear,
  getLumpSumsSum,
  getExpensesSum,
  getTravelTotal
}