/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useSyncExternalStore } from 'react'

export type Breakpoint = 'mobile' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const BREAKPOINTS: Record<Exclude<Breakpoint, 'mobile'>, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

function getViewportWidth(): number {
  if (typeof document !== 'undefined' && document.documentElement) {
    return document.documentElement.clientWidth
  }
  if (typeof window !== 'undefined' && window.visualViewport?.width) {
    return window.visualViewport.width
  }
  if (typeof window !== 'undefined' && window.innerWidth) {
    return window.innerWidth
  }
  return 0
}

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS['2xl']) return '2xl'
  if (width >= BREAKPOINTS.xl) return 'xl'
  if (width >= BREAKPOINTS.lg) return 'lg'
  if (width >= BREAKPOINTS.md) return 'md'
  if (width >= BREAKPOINTS.sm) return 'sm'
  return 'mobile'
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  callback()

  window.addEventListener('resize', callback)

  const mediaQueries = [
    window.matchMedia(`(min-width: ${BREAKPOINTS.sm}px)`),
    window.matchMedia(`(min-width: ${BREAKPOINTS.md}px)`),
    window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`),
    window.matchMedia(`(min-width: ${BREAKPOINTS.xl}px)`),
    window.matchMedia(`(min-width: ${BREAKPOINTS['2xl']}px)`),
  ]

  mediaQueries.forEach((mq) => {
    if (mq.addEventListener) {
      mq.addEventListener('change', callback)
    } else {
      mq.addListener(callback)
    }
  })

  window.visualViewport?.addEventListener('resize', callback)

  const pollInterval = setInterval(callback, 16)

  return () => {
    window.removeEventListener('resize', callback)
    mediaQueries.forEach((mq) => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', callback)
      } else {
        mq.removeListener(callback)
      }
    })
    window.visualViewport?.removeEventListener('resize', callback)
    clearInterval(pollInterval)
  }
}

function getSnapshot(): Breakpoint {
  if (typeof window === 'undefined') return 'mobile'
  return getBreakpoint(getViewportWidth())
}

function getServerSnapshot(): Breakpoint {
  return 'mobile'
}

export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
