import { Locale, locales } from '../types.js'
import de from './de.json' with { type: 'json' }
import en from './en.json' with { type: 'json' }

type Local = string | { [key: string]: Local }

export function loadLocales(overwrite: { [key in Locale]: { [key: string]: string } }) {
  const messages = { de, en }
  for (const lang of locales) {
    for (const identifier in overwrite[lang]) {
      let pathExists = false
      let tmpCheckObj: { [key: string]: Local } = messages[lang]
      if (tmpCheckObj) {
        const pathToMessage = identifier.split('.')
        pathExists = true
        for (let i = 0; i < pathToMessage.length; i++) {
          if (tmpCheckObj[pathToMessage[i]]) {
            if (i === pathToMessage.length - 1) {
              tmpCheckObj[pathToMessage[i]] = overwrite[lang]?.[identifier]
            } else {
              tmpCheckObj = tmpCheckObj[pathToMessage[i]] as { [key: string]: Local }
            }
          } else {
            pathExists = false
            break
          }
        }
      }
      if (!pathExists) {
        console.error(`Locale Overwrite: No message found at '${identifier}' (${lang})`)
      }
    }
  }
  return messages
}
