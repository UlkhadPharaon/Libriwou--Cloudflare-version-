import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from './locales/fr.json';
import en from './locales/en.json';

// Detect saved language or browser, fallback to fr (app originally French)
const saved = typeof window !== 'undefined' ? localStorage.getItem('libriwouo_lang') : null;
const browser = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'fr';
const initial = saved || (browser.startsWith('en') ? 'en' : 'fr');

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: initial,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    // allow missing keys to show key (helps during incremental migration)
    saveMissing: false,
  });

// Persist on change
i18n.on('languageChanged', (lng) => {
  try { localStorage.setItem('libriwouo_lang', lng); } catch {}
  try { document.documentElement.lang = lng; } catch {}
});
try { document.documentElement.lang = initial; } catch {}

export default i18n;
export const SUPPORTED_LANGS = ['fr', 'en'] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];
