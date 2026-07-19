import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  create: vi.fn(),
  registerPlugin: vi.fn(),
  reverts: [] as ReturnType<typeof vi.fn>[],
}))

vi.mock('gsap', () => ({
  default: {
    context: mocks.context,
    registerPlugin: mocks.registerPlugin,
  },
}))

vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: { create: mocks.create },
}))

import { ScrollScene } from './ScrollScene'

function stubMotionPreference(
  matches: boolean,
  legacy = false
) {
  const listeners: ((event: MediaQueryListEvent) => void)[] = []
  const addEventListener = vi.fn((_type, listener) => listeners.push(listener))
  const removeEventListener = vi.fn((_type, listener) => {
    listeners.splice(listeners.indexOf(listener), 1)
  })
  const addListener = vi.fn((listener) => listeners.push(listener))
  const removeListener = vi.fn((listener) => {
    listeners.splice(listeners.indexOf(listener), 1)
  })
  const media = {
    matches,
    ...(legacy ? { addListener, removeListener } : { addEventListener, removeEventListener }),
  } as unknown as MediaQueryList & { emit: (matches: boolean) => void }
  media.emit = (nextMatches) => {
    Object.defineProperty(media, 'matches', { configurable: true, value: nextMatches })
    listeners.slice().forEach((listener) => listener({ matches: nextMatches } as MediaQueryListEvent))
  }
  vi.stubGlobal('matchMedia', () => media)
  return { media, addEventListener, removeEventListener, addListener, removeListener }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.reverts = []
  mocks.context.mockImplementation((setup: () => void) => {
    setup()
    const revert = vi.fn()
    mocks.reverts.push(revert)
    return { revert }
  })
})

describe('ScrollScene', () => {
  it('renders children inside a classed pin scene root', () => {
    stubMotionPreference(false)

    render(
      <ScrollScene className="scene-shell" scene="pin">
        <div>Scene content</div>
      </ScrollScene>
    )

    expect(screen.getByText('Scene content').parentElement).toHaveClass(
      'scene-shell'
    )
    expect(screen.getByText('Scene content').parentElement).toHaveAttribute(
      'data-scene',
      'pin'
    )
  })

  it.each([
    ['pin', 'data-scene-pin'],
    ['stack', 'data-stack-card'],
  ] as const)('creates triggers for %s targets', (scene, attribute) => {
    stubMotionPreference(false)
    const { container } = render(
      <ScrollScene scene={scene}>
        <div {...{ [attribute]: '' }} />
      </ScrollScene>
    )
    const target = container.querySelector(`[${attribute}]`)

    expect(mocks.create).toHaveBeenCalledWith({ trigger: target, pin: target })
  })

  it('uses legacy listener APIs and removes matching listener', () => {
    const media = stubMotionPreference(true, true)
    const { unmount } = render(
      <ScrollScene scene="pin">
        <div data-scene-pin />
      </ScrollScene>
    )

    expect(media.addListener).toHaveBeenCalledWith(expect.any(Function))
    unmount()
    expect(media.removeListener).toHaveBeenCalledWith(media.addListener.mock.calls[0][0])
    expect(media.addEventListener).not.toHaveBeenCalled()
  })

  it('reverts on reduced-motion toggle, recreates when enabled, and cleans latest context', () => {
    const media = stubMotionPreference(false)
    const { unmount } = render(
      <ScrollScene scene="pin">
        <div data-scene-pin />
      </ScrollScene>
    )

    expect(mocks.context).toHaveBeenCalledOnce()
    media.media.emit(true)
    expect(mocks.reverts[0]).toHaveBeenCalledOnce()
    expect(mocks.context).toHaveBeenCalledOnce()
    media.media.emit(false)
    expect(mocks.context).toHaveBeenCalledTimes(2)
    expect(mocks.reverts[1]).not.toHaveBeenCalled()
    unmount()
    expect(mocks.reverts[1]).toHaveBeenCalledOnce()
    expect(media.removeEventListener).toHaveBeenCalledWith(
      'change',
      media.addEventListener.mock.calls[0][1]
    )
  })

  it('leaves normal flow when reduced motion is enabled', () => {
    const media = stubMotionPreference(true)
    const { unmount } = render(
      <ScrollScene scene="pin">
        <div data-scene-pin />
      </ScrollScene>
    )

    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.context).not.toHaveBeenCalled()
    expect(media.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    unmount()
    expect(media.removeEventListener).toHaveBeenCalledWith(
      'change',
      media.addEventListener.mock.calls[0][1]
    )
  })
})
