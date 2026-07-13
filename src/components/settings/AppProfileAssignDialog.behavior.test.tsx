/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-function */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

beforeAll(() => {
  (globalThis as any).ResizeObserver =
    (globalThis as any).ResizeObserver ??
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
});

const mockAssign = vi.fn();
const mockCreateProfile = vi.fn();
const mockListProcesses = vi.fn();
const mockSuggest = vi.fn();

vi.mock('@/lib/tauri', () => ({
  tauri: {
    listRunningProcesses: () => mockListProcesses(),
    suggestProfileForApp: (name: string) => mockSuggest(name),
    createProfile: (name: string) => mockCreateProfile(name),
    assignAppProfile: (...args: any[]) => mockAssign(...args),
  },
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: any) =>
    selector({
      settings: {
        profiles: [
          {
            id: 'p-fast',
            name: 'Fast',
            step_size_px: 120,
            animation_time_ms: 50,
            acceleration_max: 5,
            tail_to_head_ratio: 4,
            animation_easing: true,
            easing_mode: 'ExponentialOut',
            reverse_wheel_direction: false,
            horizontal_smoothness: true,
          },
        ],
      },
      createProfile: mockCreateProfile,
      updateProfile: vi.fn().mockResolvedValue(undefined),
      assignAppProfile: mockAssign,
    }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { AppProfileAssignDialog } from './AppProfileAssignDialog';

describe('AppProfileAssignDialog', () => {
  beforeAll(() => {
    mockListProcesses.mockResolvedValue([
      { pid: 1, name: 'notepad.exe', window_title: 'Notepad' },
    ]);
    mockSuggest.mockResolvedValue({
      category: 'Unknown',
      category_label: 'Unknown',
      preset: { kind: 'Profile', data: {} },
    });
  });

  it('defaults to first profile (not disabled) so row click assigns the profile', async () => {
    mockAssign.mockClear();
    render(
      <AppProfileAssignDialog
        alreadyAssignedNames={[]}
        onAssign={(name, profileId) => mockAssign(name, profileId)}
      />,
    );

    // Open dialog
    fireEvent.click(screen.getByRole('button', { name: /assign/i }));

    // Wait for the process list to load
    await waitFor(() => {
      expect(screen.getByText('notepad.exe')).toBeTruthy();
    });

    // Clicking the first row should assign the first profile, not disable smoothing.
    const row = screen.getByText('notepad.exe').closest('button');
    expect(row).toBeTruthy();
    fireEvent.click(row!);

    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalled();
    });
    const [, profileId] = mockAssign.mock.calls[mockAssign.mock.calls.length - 1];
    expect(profileId).not.toBe('__disabled__');
    expect(profileId).toBe('p-fast');
  });
});
