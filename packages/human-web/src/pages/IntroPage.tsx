import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resolvePluginIcon } from '../plugins/icons';
import { usePluginHost } from '../plugins/context';

export function IntroPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { enabledIntroCards, health } = usePluginHost();
  const letterParagraphs = [
    'auth:intro.letterParagraph1',
    'auth:intro.letterParagraph2',
    'auth:intro.letterParagraph3',
    'auth:intro.letterParagraph4',
    'auth:intro.letterParagraphInvitation',
    'auth:intro.letterParagraph8',
  ];
  const pluginMap = new Map((health?.plugins ?? []).map((plugin) => [plugin.name, plugin]));

  return (
    <div className="intro-shell stagger-in">
      <section className="intro-banner">
        <div className="intro-banner__seal" />
        <div className="intro-banner__text">
          <p className="kicker">{t('auth:intro.kicker')}</p>
          <h1 className="intro-banner__title">{t('auth:intro.title')}</h1>
          <p className="intro-banner__copy">{t('auth:intro.copy')}</p>
        </div>
      </section>

      <section className="intro-bottom">
        <div className="intro-body__layout">
          <div className="intro-body__cta">
            <Link className="app-btn app-btn--lg" to="/login">{t('auth:intro.login')}</Link>
            <Link className="app-btn secondary app-btn--lg" to="/register">{t('auth:intro.register')}</Link>
          </div>

          <div className="intro-body__venues">
            {enabledIntroCards.map((venue) => {
              const Icon = resolvePluginIcon(venue.icon);
              const plugin = pluginMap.get(venue.pluginId);
              const stateText = !health ? t('auth:intro.loading') : plugin?.started ? t('auth:intro.open') : t('auth:intro.closed');
              const stateClass = !health ? 'is-loading' : plugin?.started ? 'is-open' : 'is-closed';

              return (
                <article key={`${venue.pluginId}:${venue.id}`} className="intro-venue-card">
                  <div className="row space">
                    <div className="row">
                      <span className="intro-card-icon"><Icon size={16} /></span>
                      <strong>{t(venue.titleKey)}</strong>
                    </div>
                    <span className={`intro-venue-card__status ${stateClass}`}>{stateText}</span>
                  </div>
                  <p className="section-sub u-mt-2">{t(venue.bodyKey)}</p>
                </article>
              );
            })}
          </div>
        </div>

        <article className="intro-scroll__parchment">
          <div className="intro-scroll__roll intro-scroll__roll--left" />
          <div className="intro-scroll__body">
            <p className="intro-scroll__greeting">{t('auth:intro.letterGreeting')}</p>
            {letterParagraphs.map((key) => (
              <p key={key}>{t(key)}</p>
            ))}
            <p className="intro-scroll__sign">{t('auth:intro.letterSign')}</p>
          </div>
          <div className="intro-scroll__roll intro-scroll__roll--right" />
        </article>
      </section>
    </div>
  );
}
