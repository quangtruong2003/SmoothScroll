/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-function */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';

beforeAll(() => {
  // Radix scroll-area uses ResizeObserver; stub it for jsdom.
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
};

describe('ProfileEditor layout', () => {
  it('scroll area uses min-h-0 so reverse direction row stays reachable', () => {
    render(
      <ProfileEditor profile={fakeProfile} onClose={() => undefined} />,
    );

    // Viewport is rendered into the Dialog Portal — query the document, not the root container.
    const viewport = document.body.querySelector(
      '[data-radix-scroll-area-viewport]',
    );
    expect(viewport).toBeTruthy();

    // ScrollArea Root (parent of viewport) must include min-h-0 so flex children
    // can shrink under the dialog's max-h-[85vh] cap. Without it, the viewport
    // grows to its content height and the trailing rows (reverse direction)
    // get clipped with no visible scrollbar.
    const scrollRoot = viewport!.parentElement;
    expect(scrollRoot).toBeTruthy();
    expect(scrollRoot!.className).toMatch(/min-h-0/);

    // reverse_wheel Switch must be in the DOM and labelled.
    const reverseSwitch = screen.getByLabelText('settings.reverse_wheel.title');
    expect(reverseSwitch).toBeTruthy();
  });
});
