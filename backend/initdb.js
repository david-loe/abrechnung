const fs = require('fs');
const helper = require('./helper')
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

function loadCountriesAndCurrencies() {
  var result = { countries: [], currencies: [] }
  fs.readdirSync('./data').forEach(file => {
    const matched = file.match(/countries_(\d{4}-\d{2}-\d{2})\.tsv/i)
    if (matched && matched.length > 1) {
      const dataStr = fs.readFileSync('./data/' + file, 'utf8')
      result = helper.parseRawCountriesAndCurrencies(dataStr)
    }
  });
  return result
}

const initer = function (model, name, data) {
  return new Promise((resolve) => {
    model.find({}, (err, docs) => {
      if (docs.length === 0) {
        model.insertMany(data, (err, docs) => {
          if (err) {
            console.log(err)
          }
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

function initCountries(countries) {
  return new Promise((resolve) => {
    Country.find({}, async (err, docs) => {
      if (docs.length === 0) {
        for (const country of countries) {
          const currency = await Currency.findOne({ code: country.currency })
          country.currency = currency._id
        }
        Country.insertMany(countries, (err, result) => {
          if (err) {
            console.log(err)
          }
          console.log('Added ' + result.length + ' countries')
          resolve()
        })
      } else {
        console.log(docs.length + ' Countries exist')
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
  const { countries, currencies } = loadCountriesAndCurrencies()
  initer(Currency, 'currencies', currencies).then(() => {
    initCountries(countries).then(() => {
      addAllLumpSums()
    })
  })
}

initDB()
