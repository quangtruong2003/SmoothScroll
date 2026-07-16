// @vitest-environment jsdom
import '@testing-library/jest-dom';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfilePill } from '../ProfilePill';
import { useSettingsStore } from '@/stores/settingsStore';

const mockInvoke = vi.fn();

/** Wrap component in a .tray-panel-root so `closest()` finds it. */
function PanelWrapper({ children }: { children: React.ReactNode }) {
  return <div className="tray-panel-root">{children}</div>;
}

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
  mockInvoke.mockReset();
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
    render(<PanelWrapper><ProfilePill ctx={mockCtx} /></PanelWrapper>);
    expect(screen.getByText(/Reading/)).toBeInTheDocument();
  });

  it('opens popover on click and selects disable option', async () => {
    render(<PanelWrapper><ProfilePill ctx={mockCtx} /></PanelWrapper>);
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
    render(<PanelWrapper><ProfilePill ctx={mockCtx} /></PanelWrapper>);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(
      within(listbox).getByRole('option', { name: /default/i }),
    );
    expect(mockInvoke).toHaveBeenCalledWith('unassign_app_profile', {
      processName: 'Notepad.exe',
    });
  });

  it('closes popover without IPC when reselecting assigned profile', async () => {
    render(<PanelWrapper><ProfilePill ctx={mockCtx} /></PanelWrapper>);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    const listbox = await screen.findByRole('listbox');
    mockInvoke.mockClear();
    await userEvent.click(
      within(listbox).getByRole('option', { name: /Reading/ }),
    );
    expect(mockInvoke).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('assigns a different user profile', async () => {
    const settings = useSettingsStore.getState().settings!;
    useSettingsStore.setState({
      settings: {
        ...settings,
        profiles: [
          ...settings.profiles,
          { ...settings.profiles[0], id: 'p2', name: 'Writing' },
        ],
      },
    } as any);
    render(<PanelWrapper><ProfilePill ctx={mockCtx} /></PanelWrapper>);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    const listbox = await screen.findByRole('listbox');
    mockInvoke.mockClear();
    await userEvent.click(
      within(listbox).getByRole('option', { name: /Writing/ }),
    );
    expect(mockInvoke).toHaveBeenCalledWith('assign_app_profile', {
      processName: 'Notepad.exe',
      profileId: 'p2',
    });
  });

  it('updates pill label immediately after assigning a different profile', async () => {
    const settings = useSettingsStore.getState().settings!;
    useSettingsStore.setState({
      settings: {
        ...settings,
        profiles: [
          ...settings.profiles,
          { ...settings.profiles[0], id: 'p2', name: 'Writing' },
        ],
      },
    } as any);
    render(<PanelWrapper><ProfilePill ctx={mockCtx} /></PanelWrapper>);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(
      within(listbox).getByRole('option', { name: /Writing/ }),
    );

    expect(await screen.findByText('tray.profile_label: Writing')).toBeInTheDocument();
  });

  it('keeps old pill label while assignment is pending', async () => {
    const settings = useSettingsStore.getState().settings!;
    useSettingsStore.setState({
      settings: {
        ...settings,
        profiles: [
          ...settings.profiles,
          { ...settings.profiles[0], id: 'p2', name: 'Writing' },
        ],
      },
    } as any);
    let resolveAssignment!: () => void;
    mockInvoke.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveAssignment = resolve; }),
    );
    render(<PanelWrapper><ProfilePill ctx={mockCtx} /></PanelWrapper>);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(
      within(listbox).getByRole('option', { name: /Writing/ }),
    );

    expect(screen.getByText('tray.profile_label: Reading')).toBeInTheDocument();
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    resolveAssignment();
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('ignores another profile selection while assignment is pending', async () => {
    const settings = useSettingsStore.getState().settings!;
    useSettingsStore.setState({
      settings: {
        ...settings,
        profiles: [
          ...settings.profiles,
          { ...settings.profiles[0], id: 'p2', name: 'Writing' },
          { ...settings.profiles[0], id: 'p3', name: 'Coding' },
        ],
      },
    } as any);
    let resolveAssignment!: () => void;
    mockInvoke.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveAssignment = resolve; }),
    );
    render(<PanelWrapper><ProfilePill ctx={mockCtx} /></PanelWrapper>);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(
      within(listbox).getByRole('option', { name: /Writing/ }),
    );
    await userEvent.click(
      within(listbox).getByRole('option', { name: /Coding/ }),
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);

    resolveAssignment();
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('keeps old pill label and popover open when assignment is rejected', async () => {
    const settings = useSettingsStore.getState().settings!;
    useSettingsStore.setState({
      settings: {
        ...settings,
        profiles: [
          ...settings.profiles,
          { ...settings.profiles[0], id: 'p2', name: 'Writing' },
        ],
      },
    } as any);
    mockInvoke.mockRejectedValueOnce(new Error('assignment failed'));
    render(<PanelWrapper><ProfilePill ctx={mockCtx} /></PanelWrapper>);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    const listbox = await screen.findByRole('listbox');
    await userEvent.click(
      within(listbox).getByRole('option', { name: /Writing/ }),
    );

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('assign_app_profile', {
        processName: 'Notepad.exe',
        profileId: 'p2',
      });
    });
    expect(screen.getByText('tray.profile_label: Reading')).toBeInTheDocument();
    expect(listbox).toBeInTheDocument();
  });

  it('closes popover on Escape key', async () => {
    render(<PanelWrapper><ProfilePill ctx={mockCtx} /></PanelWrapper>);
    await userEvent.click(screen.getByRole('button', { name: /profile/i }));
    await screen.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('returns null when no profiles exist', () => {
    useSettingsStore.setState({ settings: { profiles: [], app_profiles: {} } } as any);
    const { container } = render(<PanelWrapper><ProfilePill ctx={mockCtx} /></PanelWrapper>);
    expect(container.querySelector('.tray-row')).toBeNull();
  });
});
