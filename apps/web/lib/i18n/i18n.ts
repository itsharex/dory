/* eslint-disable @typescript-eslint/no-explicit-any */
import { createTranslator } from 'next-intl';
import en from '../../public/locales/en.json';
import es from '../../public/locales/es.json';
import ja from '../../public/locales/ja.json';
import zh from '../../public/locales/zh.json';

const messages = {
    en,
    es,
    ja,
    zh,
};

export function translate(locale: keyof typeof messages, key: string, values?: Record<string, any>): string {
    const t = createTranslator({ locale, messages: messages[locale] });
    return t(key as any, values);
}
