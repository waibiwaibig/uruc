import { useTranslation } from 'react-i18next';
import { getCurrentLocale, setLocale } from '../i18n';
import type { AppLocale } from '../lib/storage';

export function LanguageToggle() {
  const { t } = useTranslation('common');
  const locale = getCurrentLocale();

  const onChange = (nextLocale: AppLocale) => {
    if (nextLocale === locale) return;
    void setLocale(nextLocale);
  };

  return (
    <div className="language-toggle" role="group" aria-label={t('language.label')}>
      <button
        type="button"
        className={`language-toggle__button${locale === 'en' ? ' is-active' : ''}`}
        onClick={() => onChange('en')}
      >
        {t('language.en')}
      </button>
      <button
        type="button"
        className={`language-toggle__button${locale === 'zh-CN' ? ' is-active' : ''}`}
        onClick={() => onChange('zh-CN')}
      >
        {t('language.zh')}
      </button>
    </div>
  );
}
