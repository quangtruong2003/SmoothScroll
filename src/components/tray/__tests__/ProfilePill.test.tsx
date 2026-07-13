// @vitest-environment jsdom
import '@testing-library/jest-dom';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfilePill } from '../ProfilePill';
import { useSettingsStore } from '@/stores/settingsStore';

const mockInvoke = vi.fn();

const mockCtx = {
  process_name: 'Notepad.exe',
  current_profile_id: 'p1',
  is_excluded: false,
  suggested_category: null,
  app_icon_base64: null,
} as any;

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

beforeEach(() => {
  useSettingsStore.setState({
    settings: {
      profiles: [
        {
          id: 'p1',
          name: 'Reading',
          step_size_px: 80,
          animation_time_ms: 200,
          acceleration_max: 1.5,
          tail_to_head_ratio: 0.7,
          animation_easing: true,
          easing_mode: 'ExponentialOut',
          reverse_wheel_direction: false,
          horizontal_smoothness: false,
        },
      ],
      app_profiles: { 'Notepad.exe': 'p1' },
    },
  } as any);
  mockInvoke.mockResolvedValue(null);
});

describe('ProfilePill', () => {
  it('renders current profile name', () => {
    render(<ProfilePill ctx={mockCtx} />);
    expect(screen.getByText(/Reading/)).toBeInTheDocument();
  });

  it('opens popover on click and selects disable option', async () => {
    render(<ProfilePill ctx={mockCtx} />);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(
      within(listbox).getByRole('option', { name: /disable/i }),
    );
    expect(mockInvoke).toHaveBeenCalledWith('assign_app_profile', {
      processName: 'Notepad.exe',
      profileId: '__disabled__',
    });
  });

  it('selects default option to unassign profile', async () => {
    render(<ProfilePill ctx={mockCtx} />);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(
      within(listbox).getByRole('option', { name: /default/i }),
    );
    expect(mockInvoke).toHaveBeenCalledWith('unassign_app_profile', {
      processName: 'Notepad.exe',
    });
  });

  it('selects a user profile', async () => {
    render(<ProfilePill ctx={mockCtx} />);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(
      within(listbox).getByRole('option', { name: /Reading/ }),
    );
    expect(mockInvoke).toHaveBeenCalledWith('assign_app_profile', {
      processName: 'Notepad.exe',
      profileId: 'p1',
    });
  });

  it('closes popover on Escape key', async () => {
    render(<ProfilePill ctx={mockCtx} />);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('returns null when no profiles exist', () => {
    useSettingsStore.setState({ settings: { profiles: [], app_profiles: {} } } as any);
    const { container } = render(<ProfilePill ctx={mockCtx} />);
    expect(container.firstChild).toBeNull();
  });
});
