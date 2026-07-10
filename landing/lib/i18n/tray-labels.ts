import type { Locale } from './dict'

export type { Locale }

export interface TrayLabels {
  header: string
  status_on: string
  status_off: string
  smooth_scrolling: string
  start_with_windows: string
  open_settings: string
  quit: string
  current_app: string
  reopen: string
}

const labels: Record<Locale, TrayLabels> = {
  en: {
    header: 'SmoothScroll',
    status_on: 'On',
    status_off: 'Off',
    smooth_scrolling: 'Smooth Scrolling',
    start_with_windows: 'Start with Windows',
    open_settings: 'Open Settings',
    quit: 'Quit',
    current_app: 'Chrome',
    reopen: 'Click to reopen',
  },
  vi: {
    header: 'SmoothScroll',
    status_on: 'Bật',
    status_off: 'Tắt',
    smooth_scrolling: 'Cuộn mượt',
    start_with_windows: 'Khởi động cùng Windows',
    open_settings: 'Mở cài đặt',
    quit: 'Thoát',
    current_app: 'Chrome',
    reopen: 'Nhấn để mở lại',
  },
  zh: {
    header: 'SmoothScroll',
    status_on: '已启用',
    status_off: '已停用',
    smooth_scrolling: '平滑滚动',
    start_with_windows: '随 Windows 启动',
    open_settings: '打开设置',
    quit: '退出',
    current_app: 'Chrome',
    reopen: '点击重新打开',
  },
}

export function getTrayLabels(locale: Locale): TrayLabels {
  return labels[locale]
}
