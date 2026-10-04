import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { de } from './de.js';
import { en } from './en.js';

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('pvm.lang') : null;
const detected =
  stored ?? (typeof navigator !== 'undefined' && navigator.language.startsWith('de') ? 'de' : 'en');

void i18n.use(initReactI18next).init({
  resources: { de, en },
  lng: detected,
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('pvm.lang', lng);
});

export default i18n;
