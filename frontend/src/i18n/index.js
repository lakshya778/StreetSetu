import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';

const savedLanguage = localStorage.getItem('streetsetu_language');
const initialLanguage = savedLanguage === 'hi' ? 'hi' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi }
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initImmediate: false
});

i18n.on('languageChanged', (language) => {
  localStorage.setItem('streetsetu_language', language === 'hi' ? 'hi' : 'en');
});

export default i18n;
