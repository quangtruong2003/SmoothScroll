import { afterEach, describe, expect, it } from 'vitest'
import { DOWNLOAD_ATTRIBUTION_KEY, recordDownloadIntent } from './downloadAttribution'

describe('recordDownloadIntent', () => {
  afterEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('stores the current landing path and query locally', () => {
    window.history.replaceState({}, '', '/smooth-scrolling-vscode-windows/?utm_source=google')

    const detail = recordDownloadIntent('https://github.com/example/download.exe')
    const stored = JSON.parse(window.sessionStorage.getItem(DOWNLOAD_ATTRIBUTION_KEY) ?? '{}')

    expect(detail).toMatchObject({
      page: '/smooth-scrolling-vscode-windows/',
      search: '?utm_source=google',
      downloadUrl: 'https://github.com/example/download.exe',
    })
    expect(stored).toMatchObject(detail!)
    expect(typeof detail?.timestamp).toBe('number')
  })

  it('emits the existing download event with attribution detail', () => {
    let received: unknown
    window.addEventListener('smoothscroll:downloaded', (event) => {
      received = (event as CustomEvent).detail
    }, { once: true })

    const detail = recordDownloadIntent('https://github.com/example/download.exe')

    expect(received).toEqual(detail)
  })
})
