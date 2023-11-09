import fs from 'fs'

export function loadLumpSums() {
  const lumpSums: { validFrom: Date; data: any }[] = []
  fs.readdirSync('./data').forEach((file) => {
    const matched = file.match(/lumpSums_(\d{4}-\d{2}-\d{2})\.tsv/i)
    if (matched && matched.length > 1) {
      const dataStr = fs.readFileSync('./data/' + file, 'utf8')
      const validFrom = new Date(matched[1])
      const data = parseRawLumpSums(dataStr)
      lumpSums.push({ validFrom, data })
    }
  })
  if (!fs.existsSync('./data/lumpSums.json')) fs.writeFileSync('./data/lumpSums.json', JSON.stringify(lumpSums), 'utf-8')
  return lumpSums
}

/**
 * @returns Array of JS Objects
 */
export function csvToObjects(csv: string, separator = '\t', arraySeparator = ', '): { [key: string]: string | string[] }[] {
  var lines = csv.split('\n')
  var result = []
  var headers = lines[0].split(separator)
  for (var i = 1; i < lines.length; i++) {
    var obj: { [key: string]: string | string[] } = {}
    if (lines[i] === '') {
      break
    }
    var currentline = lines[i].split(separator)
    for (var j = 0; j < headers.length; j++) {
      // search for [] to identify arrays
      const match = currentline[j].match(/^\[(.*)\]$/)
      if (match === null) {
        if (currentline[j] !== '') {
          obj[headers[j]] = currentline[j]
        }
      } else {
        obj[headers[j]] = match[1].split(arraySeparator)
      }
    }
    result.push(obj)
  }
  return result
}

export function parseRawLumpSums(dataStr: string) {
  const general = /im Übrigen/i
  const spezialStart = /^–\s{2,}(.*)/i
  const data: { [key: string]: string | string[] | { [key: string]: string | string[] }[] }[] = csvToObjects(dataStr)
  var spezials = []
  for (var i = data.length - 1; i >= 0; i--) {
    const matched = (data[i].country as string).match(spezialStart)
    if (matched && matched.length > 1) {
      data[i].city = matched[1]
      delete data[i].country
      spezials.push(data[i])
      data.splice(i, 1)
    } else if (spezials.length > 0) {
      for (var j = spezials.length - 1; j >= 0; j--) {
        if (general.test(spezials[j].city as string)) {
          delete spezials[j].city
          Object.assign(data[i], spezials[j])
          spezials.splice(j, 1)
          break
        }
      }
      data[i].spezials = spezials as { [key: string]: string | string[] }[]
      spezials = []
    }
  }
  return data
}
