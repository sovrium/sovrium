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

interface VideoTrack {
  readonly src: string
  readonly kind?: string
  readonly srclang?: string
  readonly label?: string
}

function toEmbedUrl(src: string | undefined): string | undefined {
  if (!src) return undefined
  const youtubeWatch = src.match(/youtube\.com\/watch\?v=([\w-]+)/)
  if (youtubeWatch) return `https://www.youtube.com/embed/${youtubeWatch[1]}`
  const youtubeShort = src.match(/youtu\.be\/([\w-]+)/)
  if (youtubeShort) return `https://www.youtube.com/embed/${youtubeShort[1]}`
  const vimeo = src.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return undefined
}

export function renderVideo(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  const {
    autoplay,
    aspectRatio: _ar,
    tracks,
    sources: _sources,
    src,
    ...rest
  } = props as {
    autoplay?: boolean
    aspectRatio?: string
    tracks?: readonly VideoTrack[]
    sources?: unknown
    src?: string
    [key: string]: unknown
  }

  const embedUrl = toEmbedUrl(src)
  if (embedUrl) {
    return (
      <iframe
        {...rest}
        src={embedUrl}
        title={(rest['title'] as string | undefined) ?? 'Video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  const trackChildren = tracks?.map((track, i) => (
    <track
      key={i}
      src={track.src}
      kind={track.kind}
      srcLang={track.srclang}
      label={track.label}
    />
  ))

  return (
    <video
      {...rest}
      src={src}
      autoPlay={autoplay}
    >
      {trackChildren}
      {children}
    </video>
  )
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
