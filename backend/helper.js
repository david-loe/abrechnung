const i18n = require('./i18n')
const Country = require('./models/country')

function getter(model, name, defaultLimit = 10, preConditions = {}, select = {}) {
  return async (req, res) => {
    const meta = {
      limit: defaultLimit,
      page: 1,
      count: null,
      countPages: null,
    }
    if (req.query.limit && parseInt(req.query.limit) <= meta.limit && parseInt(req.query.limit) > 0) {
      meta.limit = parseInt(req.query.limit)
    }
    if (req.query.page && parseInt(req.query.page) > 0) {
      meta.page = parseInt(req.query.page)
    }
    if (req.query.id && req.query.id != '') {
      const result = await model.findOne({ _id: req.query.id })
      if (result != null) {
        res.send({ data: result })
      } else {
        res.status(204).send({ message: 'No ' + name + ' with id ' + req.query.id })
      }
    } else {
      var conditions = {}
      for (const filter of Object.keys(req.query)) {
        if (req.query[filter] && req.query[filter].length > 0) {
          var qFilter = {}
          if(req.query[filter].indexOf('name') !== -1){
            qFilter[filter] = { $regex: req.query[filter], $options: 'i' }
          }else{
            qFilter[filter] = req.query[filter]
          }
          if (!('$and' in conditions)) {
            conditions.$and = []
          }
          conditions.$and.push(qFilter)
        }
      }
      if(Object.keys(preConditions).length > 0){
        if (!('$and' in conditions)) {
          conditions.$and = []
        }
        conditions.$and.push(preConditions)
      }
      const result = await model.find(conditions, select)
      meta.count = result.length
      meta.countPages = Math.ceil(meta.count / meta.limit)
      if (result != null) {
        res.send({ meta: meta, data: result.slice(meta.limit * (meta.page - 1), meta.limit * meta.page) })
      } else {
        res.status(204).send({ message: 'No content' })
      }
    }
  }
}


function setter(model, checkUserIdField = '', allowNew = true, checkOldObject = null) {
  return async (req, res) => {
    for (const field of Object.keys(model.schema.tree)) {
      if (model.schema.tree[field].required) {
        if (
          req.body[field] === undefined ||
          (model.schema.tree[field].type === String && req.body[field].length === 0) ||
          (model.schema.tree[field].type === Number && req.body[field] === null) ||
          (Array.isArray(model.schema.tree[field]) && req.body[field].length === 0)
        ) {
          return res.status(400).send({ message: 'Missing ' + field })
        }
      }
    }
    if (req.body._id && req.body._id !== '') {
      if (checkUserIdField && checkUserIdField in model.schema.tree) {
        var oldObject = await model.findOne({ _id: req.body._id })
        if (!oldObject[checkUserIdField]._id.equals(req.user._id)) {
          return res.send(403)
        }
        if(checkOldObject){
          if(!(await checkOldObject(oldObject))){
            return res.send(403)
          }
        }
      }
      try {
        const result = await model.findOneAndUpdate({ _id: req.body._id }, req.body, { new: true })
        res.send({ message: i18n.t('alerts.successSaving'), result: result })
      } catch (error) {
        res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
      }
    } else if(allowNew) {
      try {
        const result = await (new model(req.body)).save()
        res.send({ message: i18n.t('alerts.successSaving'), result: result })
      } catch (error) {
        res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
      }
    }else{
      return res.send(403)
    }

  }
}

function deleter(model, checkUserIdField = '') {
  return async (req, res) => {
    if (req.query.id && req.query.id !== '') {
      if (checkUserIdField && checkUserIdField in model.schema.tree) {
        var doc = await model.findOne({ _id: req.query.id })
        if (!doc[checkUserIdField]._id.equals(req.user._id)) {
          return res.send(403)
        }
      }
      try {
        await model.deleteOne({ _id: req.query.id })
        res.send({ message: i18n.t('alerts.successDeleting') })
      } catch (error) {
        res.status(400).send({ message: i18n.t('alerts.errorDeleting'), error: error })
      }
    } else {
      return res.status(400).send({ message: 'Missing id' })
    }
  }
}

/**
 * 
 * @param {string} csv 
 * @param {string} separator 
 * @param {string} arraySeparator 
 * @returns Array of JS Objects
 */
function csvToObjects(csv, separator = '\t', arraySeparator = ', ') {
  var lines = csv.split("\n");
  var result = [];
  var headers = lines[0].split(separator);
  for (var i = 1; i < lines.length; i++) {
    var obj = {};
    if (lines[i] === '') {
      break
    }
    var currentline = lines[i].split(separator);
    for (var j = 0; j < headers.length; j++) {
      // search for [] to identify arrays
      const match = currentline[j].match(/^\[(.*)\]$/)
      if (match === null) {
        obj[headers[j]] = currentline[j];
      } else {
        obj[headers[j]] = match[1].split(arraySeparator)
      }

    }
    result.push(obj);
  }
  return result
}

function objectsToCSV(objects, separator = '\t', arraySeparator = ', ') {
  const array = [Object.keys(objects[0])].concat(objects)

  return array.map(it => {
    return Object.values(it).map(item => {
      if (Array.isArray(item)) {
        return '[' + item.join(arraySeparator) + ']'
      } else if (item === null) {
        return 'null'
      } else {
        return item
      }
    }).join(separator)
  }).join('\n')
}

function getFlagEmoji(countryCode) {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

/**
 * 
 * @param {String} dataStr 
 * 
 * @returns {Array} LumpSums
 */
function parseRawLumpSums(dataStr) {
  const general = /im Übrigen/i
  const spezialStart = /^–\s{2,}(.*)/i
  const data = csvToObjects(dataStr)
  var spezials = []
  for (var i = data.length - 1; i >= 0; i--) {
    const matched = data[i].country.match(spezialStart)
    if (matched && matched.length > 1) {
      data[i].city = matched[1]
      delete data[i].country
      spezials.push(data[i])
      data.splice(i, 1)
    } else if (spezials.length > 0) {
      for (var j = spezials.length - 1; j >= 0; j--) {
        if (general.test(spezials[j].city)) {
          delete spezials[j].city
          Object.assign(data[i], spezials[j])
          spezials.splice(j, 1)
          break
        }
      }
      data[i].spezials = spezials
      spezials = []
    }
  }
  return data
}

function rawCountryAndCurrencyToCountryAndCurrency(rawCountry) {
  return {
    country: {
      name: {
        de: rawCountry.countryNameDE,
        en: rawCountry.countryNameEN
      },
      alias: {
        de: rawCountry.countryAliasDE
      },
      code: rawCountry.countryCode,
      currency: rawCountry.currencyCode,
      lumpSumsFrom: rawCountry.lumpSumsFrom,
      flag: getFlagEmoji(rawCountry.countryCode)
    },
    currency: {
      name: {
        de: rawCountry.currencyNameDE,
        en: rawCountry.currencyNameEN
      },
      code: rawCountry.currencyCode,
      subUnit: rawCountry.currencySubunit
    }
  }
}

function parseRawCountriesAndCurrencies(dataStr) {
  const data = csvToObjects(dataStr)
  const countries = []
  const currencies = []
  for (const rawCountry of data) {
    const {country, currency} = rawCountryAndCurrencyToCountryAndCurrency(rawCountry)
    countries.push(country)
    if(currencies.findIndex((c) => c.code === currency.code) === -1){
      currencies.push(currency)
    }
  }
  return {countries, currencies}
}

async function addLumpSumsToCountries(lumpSums, validFrom, countryNameLanguage = 'de'){
  const conditions = {}
  const noCountryFound = []
  const success = []
  const noUpdate = []
  for (const lumpSum of lumpSums){
    conditions.$or = [{},{}]
    conditions.$or[0]['name.' + countryNameLanguage] = lumpSum.country
    conditions.$or[1]['alias.' + countryNameLanguage] = lumpSum.country

    const country = await Country.findOne(conditions)
    if(country){
      var newData = true
      for(const countrylumpSums of country.lumpSums){
        if(countrylumpSums.validFrom >= validFrom){
          newData = false
          break
        }
      }
      if(newData){
        lumpSum.validFrom = validFrom
        country.lumpSums.push(lumpSum)
        country.markModified('lumpSums')
        success.push(await country.save())
      }else{
        noUpdate.push(country)
      }
    }else{
      noCountryFound.push(lumpSum)
    }
  }
  return {success, noUpdate, noCountryFound}
}


module.exports = {
  getter: getter,
  setter: setter,
  deleter: deleter,
  csvToObjects: csvToObjects,
  objectsToCSV: objectsToCSV,
  getFlagEmoji: getFlagEmoji,
  parseRawLumpSums: parseRawLumpSums,
  parseRawCountriesAndCurrencies: parseRawCountriesAndCurrencies,
  addLumpSumsToCountries: addLumpSumsToCountries
}