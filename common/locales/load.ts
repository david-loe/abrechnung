import { Locale } from '../types.js'
import de from './de.json' assert { type: 'json' }
import en from './en.json' assert { type: 'json' }

export function loadLocales(overwriteJSONstring?: string) {
  const messages = { de, en }
  if (overwriteJSONstring) {
    let overwrite: { [key in Locale]?: { [key: string]: string } } | null = null
    try {
      overwrite = JSON.parse(overwriteJSONstring)
    } catch (error) {
      console.error('LOCALES_OVERWRITE Error')
      console.error(error)
    }
    if (overwrite) {
      for (const lang in overwrite) {
        for (const identifier in overwrite[lang as Locale]) {
          let pathExists = false
          let tmpCheckObj: any = messages[lang as Locale]
          if (tmpCheckObj) {
            let pathToMessage = identifier.split('.')
            pathExists = true
            for (let i = 0; i < pathToMessage.length; i++) {
              if (tmpCheckObj[pathToMessage[i]]) {
                if (i === pathToMessage.length - 1) {
                  tmpCheckObj[pathToMessage[i]] = overwrite[lang as Locale]![identifier]
                } else {
                  tmpCheckObj = tmpCheckObj[pathToMessage[i]]
                }
              } else {
                pathExists = false
                break
              }
            }
          }
          if (!pathExists) {
            console.error(`ENV: VITE_I18N_LOCALES_OVERWRITE: No message found at '${identifier}' (${lang})`)
          }
        }
      }
    }
  }
  return messages
}
