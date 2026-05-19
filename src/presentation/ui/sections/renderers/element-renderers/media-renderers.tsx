/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { ElementProps } from './html-element-renderer'

export function renderImage(props: ElementProps): ReactElement {
  return (
    <img
      {...props}
      alt={(props.alt as string | undefined) || ''}
    />
  )
}

export function renderAvatar(props: ElementProps): ReactElement {
  const style = {
    ...((props.style as Record<string, unknown> | undefined) || {}),
    minWidth: '48px',
    minHeight: '48px',
    width: '48px',
    height: '48px',
  }

  return (
    <img
      {...props}
      style={style}
      alt={(props.alt as string | undefined) || ''}
      className={[props.className, 'rounded-full'].filter(Boolean).join(' ')}
    />
  )
}

export function renderThumbnail(props: ElementProps): ReactElement {
  return (
    <img
      {...props}
      alt={(props.alt as string | undefined) || ''}
      className={[props.className, 'rounded-md'].filter(Boolean).join(' ')}
    />
  )
}

export function renderHeroImage(props: ElementProps): ReactElement {
  return (
    <img
      {...props}
      alt={(props.alt as string | undefined) || ''}
      className={[props.className, 'rounded-t-lg'].filter(Boolean).join(' ')}
    />
  )
}

export function renderVideo(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  return <video {...props}>{children}</video>
}

export function renderAudio(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  return <audio {...props}>{children}</audio>
}

export function renderIframe(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  return <iframe {...props}>{children}</iframe>
}
