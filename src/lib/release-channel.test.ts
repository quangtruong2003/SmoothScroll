import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getReleaseChannel } from './release-channel';

describe('getReleaseChannel', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns "beta" on macOS user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15',
    });
    expect(getReleaseChannel()).toBe('beta');
  });

  it('returns "stable" on Windows user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    expect(getReleaseChannel()).toBe('stable');
  });

  it('returns "stable" on Linux user agent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    });
    expect(getReleaseChannel()).toBe('stable');
  });

  it('returns "stable" when navigator is undefined (SSR/node)', () => {
    vi.stubGlobal('navigator', undefined);
    expect(getReleaseChannel()).toBe('stable');
  });
});
