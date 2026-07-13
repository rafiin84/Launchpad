import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { type Language, type TranslationKeys, getTranslations } from '../i18n';
import { updateAppUser, loadCachedRecordId } from '../services/crmAppUsers';

const STORAGE_KEY = 'lp_language';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
  applyFromCRM: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function loadSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ja') return 'ja';
  } catch { /* ok */ }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>(loadSavedLanguage);
  const syncingRef = useRef(false);

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ok */ }

    // Sync to CRM
    const recordId = loadCachedRecordId();
    const email = localStorage.getItem('lp_zoho_email') || localStorage.getItem('lp_portal_email') || '';
    if (recordId && email) {
      updateAppUser(recordId, { languagePreference: lang }, email).catch(() => {});
    }
  }, []);

  const applyFromCRM = useCallback((lang: string) => {
    if (lang === 'ja' || lang === 'en') {
      syncingRef.current = true;
      setLang(lang);
      try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ok */ }
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = getTranslations(language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, applyFromCRM }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
