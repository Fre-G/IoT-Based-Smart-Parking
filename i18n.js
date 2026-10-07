import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en';
import am from './locales/am';

const LANGUAGE_KEY = 'app-language';

let savedLanguage = 'en';
AsyncStorage.getItem(LANGUAGE_KEY).then(lang => {
  if (lang === 'am') savedLanguage = 'am';
}).catch(() => {});

const resources = {
  en: { translation: en },
  am: { translation: am },
};

i18n.use(initReactI18next).init({
  resources,
  lng: savedLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

i18n.on('languageChanged', (lng) => {
  AsyncStorage.setItem(LANGUAGE_KEY, lng);
});

export default i18n;