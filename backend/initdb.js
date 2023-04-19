const fs = require('fs');
const helper = require('./helper')
const { getFlagEmoji } = require('./scripts')
const Currency = require('./models/currency')
const Country = require('./models/country')

function loadLumpSums() {
  const lumpSums = []
  fs.readdirSync('./data').forEach(file => {
    const matched = file.match(/lumpSums_(\d{4}-\d{2}-\d{2})\.tsv/i)
    if (matched && matched.length > 1) {
      const dataStr = fs.readFileSync('./data/' + file, 'utf8')
      const validFrom = new Date(matched[1])
      const data = helper.parseRawLumpSums(dataStr)
      lumpSums.push({ validFrom, data })
    }
  });
  return lumpSums
}

function loadCountries() {
  const dataStr = fs.readFileSync('./data/countries.tsv', 'utf8')
  const result = helper.csvToObjects(dataStr)
  result.forEach(c => c.flag = getFlagEmoji(c.code))
  return result
}

function loadCurrencies() {
  const dataStr = fs.readFileSync('./data/currencies.tsv', 'utf8')
  const result = helper.csvToObjects(dataStr)
  result.forEach(c => c.flag = getFlagEmoji(c.code))
  return result
}

const initer = function (model, name, data) {
  return new Promise((resolve) => {
    model.find({}).then((docs) => {
      if (docs.length === 0) {
        model.insertMany(data).then((docs) => {
          console.log('Added ' + docs.length + ' ' + name)
          resolve()
        })
      } else {
        console.log(docs.length + ' ' + name + ' exist')
        resolve()
      }
    })
  })
}


function addAllLumpSums() {
  const lumpSums = loadLumpSums()
  lumpSums.sort((a, b) => a.validFrom - b.validFrom)
  for (const lumpSum of lumpSums) {
    helper.addLumpSumsToCountries(lumpSum.data, lumpSum.validFrom, 'de').then((result) => {
      console.log('Lump sum from ' + lumpSum.validFrom.toDateString() + ': ' + result.success.length + ' updated - ' + result.noUpdate.length + ' not updated - ' + result.noCountryFound.length + ' no country found')
      for (const notFound of result.noCountryFound) {
        console.log(notFound.country)
      }
    })
  }
}

function initDB() {
  initer(Currency, 'currencies', loadCurrencies()).then(() => {
    initer(Country, 'countries', loadCountries()).then(() => {
      addAllLumpSums()
    })
  })
}

initDB()
