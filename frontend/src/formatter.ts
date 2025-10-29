import Formatter from 'abrechnung-common/utils/formatter.js'
import { getLanguageFromNavigator } from './i18n'

export const formatter = new Formatter(getLanguageFromNavigator(), 'givenNameFirst')
