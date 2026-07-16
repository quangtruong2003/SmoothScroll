/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-function */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';

beforeAll(() => {
  // Radix primitives use ResizeObserver; stub it for jsdom.
  (globalThis as any).ResizeObserver =
    (globalThis as any).ResizeObserver ??
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
});

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: any) =>
    selector({ updateProfile: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { ProfileEditor } from './ProfileEditor';

const fakeProfile: any = {
  id: 'p1',
  name: 'Test',
  step_size_px: 120,
  animation_time_ms: 50,
  acceleration_max: 5,
  tail_to_head_ratio: 4,
  animation_easing: true,
  easing_mode: 'ExponentialOut',
  reverse_wheel_direction: false,
  horizontal_smoothness: true,
  smooth_zoom: true,
  zoom_invert: false,
  zoom_sensitivity: 1,
};

describe('ProfileEditor layout', () => {
  it('scrollable region uses min-h-0 so trailing rows stay reachable', () => {
    render(
      <ProfileEditor profile={fakeProfile} onClose={() => undefined} />,
    );

    // The scrollable div is rendered into the Dialog Portal.
    const scrollable = document.body.querySelector(
      '.overflow-y-auto.min-h-0',
    ) as HTMLElement;
    expect(scrollable).toBeTruthy();
    expect(scrollable.className).toMatch(/min-h-0/);

    // reverse_wheel Switch must be in the DOM and labelled.
    const reverseSwitch = screen.getByLabelText('settings.reverse_wheel.title');
    expect(reverseSwitch).toBeTruthy();
  });
});
