import {createI18n} from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'

export type SupportedLocale = 'en' | 'zh'

const LOCALE_STORAGE_KEY = 'locale'

function loadLocale(): SupportedLocale {
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (saved === 'en' || saved === 'zh') {
    return saved
  }
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) {
    return 'zh'
  }
  return 'en'
}

const i18n = createI18n({
  legacy: false,
  locale: loadLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    zh,
  },
})

export function setLocale(locale: SupportedLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.documentElement.setAttribute('lang', locale)
}

export function getCurrentLocale(): SupportedLocale {
  return i18n.global.locale.value as SupportedLocale
}

export default i18n