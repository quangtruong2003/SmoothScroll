// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useForegroundApp } from '../useForegroundApp';
import { tauri } from '@/lib/tauri';

vi.mock('@/lib/tauri', () => ({
  tauri: {
    getForegroundAppContext: vi.fn().mockResolvedValue({
      process_name: 'chrome.exe',
      current_profile_id: null,
      is_excluded: false,
    }),
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe('useForegroundApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches foreground context on mount', async () => {
    const { result } = renderHook(() => useForegroundApp());
    expect(result.current.ctx).toBeNull();
    await act(async () => {});
    expect(result.current.ctx?.process_name).toBe('chrome.exe');
  });

  it('refresh updates context', async () => {
    const { result } = renderHook(() => useForegroundApp());
    await act(async () => {});
    (tauri.getForegroundAppContext as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      process_name: 'code.exe',
      current_profile_id: 'p1',
      is_excluded: false,
    });
    await act(async () => result.current.refresh());
    expect(result.current.ctx?.process_name).toBe('code.exe');
  });
});
