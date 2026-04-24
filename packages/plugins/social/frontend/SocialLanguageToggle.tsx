import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function SocialLanguageToggle() {
  const { t } = useTranslation('common');

  return (
    <div className="language-toggle social-language-toggle" role="group" aria-label={t('language.label')}>
      <Link
        className="language-toggle__button is-active"
        to="/workspace/settings#workspace-language-settings"
      >
        {t('language.label')}
      </Link>
    </div>
  );
}
