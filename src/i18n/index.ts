import en, { type TranslationKeys } from './en';
import ja from './ja';

export type Language = 'en' | 'ja';

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
];

const translations: Record<Language, TranslationKeys> = { en, ja };

export function getTranslations(lang: Language): TranslationKeys {
  return translations[lang] || translations.en;
}

export type { TranslationKeys };
