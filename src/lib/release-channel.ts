export type ReleaseChannel = 'stable' | 'beta';

export function getReleaseChannel(): ReleaseChannel {
  if (typeof navigator === 'undefined' || !navigator) {
    return 'stable';
  }
  if (/Mac/i.test(navigator.userAgent)) {
    return 'beta';
  }
  return 'stable';
}
