import { useTranslation } from 'react-i18next';
import { getReleaseChannel } from '@/lib/release-channel';

export function BetaBadge() {
  const { t } = useTranslation();
  if (getReleaseChannel() !== 'beta') return null;

  return (
    <span
      title={t('about.beta_badge_tooltip')}
      className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30"
    >
      {t('about.beta_badge_label')}
    </span>
  );
}
