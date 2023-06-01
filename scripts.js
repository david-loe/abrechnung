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

function getMoneyString(money, useExchangeRate = true, func = (x) => x) {
  return (func(((useExchangeRate && money.exchangeRate) ? money.exchangeRate.amount : money.amount))).toLocaleString(undefined, {
    style: "currency",
    currency: (useExchangeRate && money.exchangeRate) ? "EUR" : money.currency._id // baseCurrency
  })
}

module.exports = {
  getFlagEmoji,
  getDiffInDays,
  getDayList,
  datetimeToDateString,
  getMoneyString,
}