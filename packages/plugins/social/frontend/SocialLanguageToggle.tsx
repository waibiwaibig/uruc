import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

type SocialLocale = 'en' | 'zh-CN';

function currentLocale(): SocialLocale {
  return i18n.resolvedLanguage === 'zh-CN' || i18n.language === 'zh-CN' ? 'zh-CN' : 'en';
}

export function SocialLanguageToggle() {
  const { t } = useTranslation('common');
  const locale = currentLocale();

  const onChange = (nextLocale: SocialLocale) => {
    if (nextLocale === locale) return;
    void i18n.changeLanguage(nextLocale);
  };

  return (
    <div className="language-toggle social-language-toggle" role="group" aria-label={t('language.label')}>
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
