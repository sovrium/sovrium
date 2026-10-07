/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import type { ElementProps } from './html-element-renderer'

/**
 * Loading defaults for an `<img>`: an image the author left unconfigured is
 * deferred (`loading="lazy"`) so it costs nothing until it nears the viewport,
 * while a hero — the likeliest Largest Contentful Paint element — is fetched
 * first (`loading="eager"` + `fetchpriority="high"`). An explicit
 * `props.loading` always wins, and a hero the author deferred gets no priority
 * hint. Width and height pass through untouched when the author declares them.
 */
function withLoadingDefaults(props: ElementProps, hero: boolean): ElementProps {
  if (props.loading !== undefined) return props
  if (!hero) return { ...props, loading: 'lazy' }
  const hasPriority = props.fetchPriority !== undefined || props.fetchpriority !== undefined
  return hasPriority
    ? { ...props, loading: 'eager' }
    : { ...props, loading: 'eager', fetchPriority: 'high' }
}

/**
 * Renders image element
 */
export function renderImage(props: ElementProps): ReactElement {
  return (
    <img
      {...omitInternalMarkers(withLoadingDefaults(props, false))}
      alt={(props.alt as string | undefined) || ''}
    />
  )
}

/**
 * Renders avatar image with circular border-radius
 * Includes default dimensions to ensure visibility even when image fails to load
 */
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
      {...omitInternalMarkers(withLoadingDefaults(props, false))}
      style={style}
      alt={(props.alt as string | undefined) || ''}
      className={resolveClasses('rounded-full', props.className as string | undefined)}
    />
  )
}

/**
 * Renders thumbnail image with moderate border-radius
 * Applies md radius (0.375rem) for soft corners while preserving aspect ratio
 */
export function renderThumbnail(props: ElementProps): ReactElement {
  return (
    <img
      {...omitInternalMarkers(withLoadingDefaults(props, false))}
      alt={(props.alt as string | undefined) || ''}
      className={resolveClasses('rounded-md', props.className as string | undefined)}
    />
  )
}

/**
 * Renders hero image with top-only border-radius
 * Applies lg radius to top corners only for integration with card layout
 */
export function renderHeroImage(props: ElementProps): ReactElement {
  return (
    <img
      {...omitInternalMarkers(withLoadingDefaults(props, true))}
      alt={(props.alt as string | undefined) || ''}
      className={resolveClasses('rounded-t-lg', props.className as string | undefined)}
    />
  )
}

interface VideoTrack {
  readonly src: string
  readonly kind?: string
  readonly srclang?: string
  readonly label?: string
}

/**
 * Detects a YouTube/Vimeo URL and returns its embed URL, or undefined for a
 * direct video file. YouTube `watch?v=` and `youtu.be/` and Vimeo `vimeo.com/`
 * URLs auto-convert to an iframe embed.
 */
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

/**
 * Renders video element.
 *
 * - YouTube/Vimeo URLs auto-convert to an iframe embed.
 * - `autoplay` maps to React's `autoPlay`; `tracks[]` render as `<track>`
 *   children; non-DOM props (`aspectRatio`, `tracks`, `sources`) are stripped.
 */
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
  } = omitInternalMarkers(props) as {
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

/**
 * Renders audio element
 */
export function renderAudio(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  return <audio {...omitInternalMarkers(props)}>{children}</audio>
}

/**
 * Renders iframe element
 */
export function renderIframe(
  props: ElementProps,
  children: readonly React.ReactNode[]
): ReactElement {
  return <iframe {...omitInternalMarkers(props)}>{children}</iframe>
}
