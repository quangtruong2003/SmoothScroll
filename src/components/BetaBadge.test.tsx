// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BetaBadge } from './BetaBadge';

vi.mock('@/lib/release-channel', () => ({
  getReleaseChannel: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'about.beta_badge_label': 'BETA',
        'about.beta_badge_tooltip': 'Beta tooltip text',
      };
      return map[key] ?? key;
    },
  }),
}));

import { getReleaseChannel } from '@/lib/release-channel';

describe('BetaBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing on stable channel', () => {
    vi.mocked(getReleaseChannel).mockReturnValue('stable');
    const { container } = render(<BetaBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('renders BETA label on beta channel', () => {
    vi.mocked(getReleaseChannel).mockReturnValue('beta');
    render(<BetaBadge />);
    expect(screen.getByText('BETA')).not.toBeNull();
  });

  it('exposes tooltip via title attribute on beta channel', () => {
    vi.mocked(getReleaseChannel).mockReturnValue('beta');
    render(<BetaBadge />);
    const badge = screen.getByText('BETA');
    expect(badge.getAttribute('title')).toBe('Beta tooltip text');
  });
});
