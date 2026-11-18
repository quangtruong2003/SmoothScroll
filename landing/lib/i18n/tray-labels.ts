import type { Locale } from './dict'

export type { Locale }

export interface TrayLabels {
  header: string
  status_on: string
  status_off: string
  smooth_scrolling: string
  open_settings: string
  quit: string
  current_app: string
  toggle_current_app: string
  profile_label: string
  profile_default: string
  profile_disabled: string
  reopen: string
}

const labels: Record<Locale, TrayLabels> = {
  en: {
    header: 'SmoothScroll',
    status_on: 'ON',
    status_off: 'OFF',
    smooth_scrolling: 'Smooth Scrolling',
    open_settings: 'Open Settings',
    quit: 'Quit SmoothScroll',
    current_app: 'Chrome',
    toggle_current_app: 'Toggle smoothing for Chrome',
    profile_label: 'Profile',
    profile_default: 'Default (global)',
    profile_disabled: 'Disabled',
    reopen: 'Click to reopen',
  },
  vi: {
    header: 'SmoothScroll',
    status_on: 'BẬT',
    status_off: 'TẮT',
    smooth_scrolling: 'Cuộn mượt',
    open_settings: 'Mở cài đặt',
    quit: 'Thoát SmoothScroll',
    current_app: 'Chrome',
    toggle_current_app: 'Bật/tắt làm mượt cho Chrome',
    profile_label: 'Hồ sơ',
    profile_default: 'Mặc định (global)',
    profile_disabled: 'Đã tắt',
    reopen: 'Nhấn để mở lại',
  },
  zh: {
    header: 'SmoothScroll',
    status_on: '开',
    status_off: '关',
    smooth_scrolling: '平滑滚动',
    open_settings: '打开设置',
    quit: '退出 SmoothScroll',
    current_app: 'Chrome',
    toggle_current_app: '切换 Chrome 平滑滚动',
    profile_label: '配置',
    profile_default: '默认（全局）',
    profile_disabled: '已禁用',
    reopen: '点击重新打开',
  },
}

export function getTrayLabels(locale: Locale): TrayLabels {
  return labels[locale]
}
