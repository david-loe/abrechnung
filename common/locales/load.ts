import { Locale } from '../types.js'
import de from './de.json' with { type: 'json' }
import en from './en.json' with { type: 'json' }

export function loadLocales(overwrite: { [key in Locale]?: { [key: string]: string } }) {
  delete (overwrite as any)._id
  const messages = { de, en }

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
            console.error(`Locale Overwrite: No message found at '${identifier}' (${lang})`)
          }
                }
  }
  return messages
}
