import { defineConfig } from '@vueform/vueform'
import vueform from '@vueform/vueform/dist/vueform'
import de from '@vueform/vueform/locales/de'
import en from '@vueform/vueform/locales/en'

import { defaultLocale } from '../../common/types'
import CountryElement from './components/elements/vueform/CountryElement.vue'
import CurrencyElement from './components/elements/vueform/CurrencyElement.vue'
import DocumentfileElement from './components/elements/vueform/DocumentfileElement.vue'
import HealthinsuranceElement from './components/elements/vueform/HealthinsuranceElement.vue'
import LedgeraccountElement from './components/elements/vueform/LedgeraccountElement.vue'
import MixedElement from './components/elements/vueform/MixedElement.vue'
import OrganisationElement from './components/elements/vueform/OrganisationElement.vue'
import ProjectElement from './components/elements/vueform/ProjectElement.vue'
import UserElement from './components/elements/vueform/UserElement.vue'

en.vueform.elements.list.add = '+ Add'
de.vueform.elements.list.add = '+ Hinzufügen'

const keysToExclude = new Set(['loseAccessAt'])

function deepReplace(obj: any, search: any, replacement: any, keysToExclude: Set<string> = new Set()) {
  for (const key in obj) {
    if (!keysToExclude.has(key) && obj[key] === search) {
      obj[key] = replacement
    } else if (typeof obj[key] === 'object' && !(obj[key] instanceof File)) {
      deepReplace(obj[key], search, replacement)
    }
  }
}

export default defineConfig({
  theme: vueform,
  elements: [
    CountryElement,
    DocumentfileElement,
    OrganisationElement,
    CurrencyElement,
    ProjectElement,
    LedgeraccountElement,
    HealthinsuranceElement,
    UserElement,
    MixedElement
  ],
  locales: { de, en },
  locale: defaultLocale,
  env: import.meta.env.MODE,
  displayErrors: false,
  displayMessages: false,
  endpoints: {},
  beforeSend(form$: any) {
    deepReplace(form$.data, null, undefined, keysToExclude)
    deepReplace(form$.data, '', undefined, keysToExclude)
  }
})
