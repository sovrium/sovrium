/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { CSSProperties, ReactElement } from 'react'

const DEFAULT_SPEED_SECONDS = 30

const PAUSE_LABEL = 'Pause'
const RESUME_LABEL = 'Resume'

const PAUSE_BUTTON_CLASSES =
  'border-border bg-background text-foreground rounded-md border px-2 py-1 text-xs'

const CLONE_IDENTITY_ATTRS_RE = /\s(?:id|data-testid|data-island[\w-]*)="[^"]*"/g

function stripCloneIdentity(html: string): string {
  return html.replace(CLONE_IDENTITY_ATTRS_RE, '')
}

function resolveAxis(direction: string): 'x' | 'y' {
  return direction === 'up' || direction === 'down' ? 'y' : 'x'
}

function buildBandStyle(speedSeconds: number, gap: string | undefined): CSSProperties {
  return {
    '--sv-marquee-duration': `${speedSeconds}s`,
    ...(gap !== undefined ? { '--sv-marquee-gap': gap } : {}),
  } as CSSProperties
}

function renderPauseControl(): ReactElement {
  return (
    <div className="mt-3 flex justify-end">
      <button
        type="button"
        data-marquee-pause="true"
        data-marquee-pause-label={PAUSE_LABEL}
        data-marquee-resume-label={RESUME_LABEL}
        className={PAUSE_BUTTON_CLASSES}
      >
        {PAUSE_LABEL}
      </button>
    </div>
  )
}

export const marqueeComponent: ComponentRenderer = ({
  elementProps,
  component,
  renderedChildren,
}) => {
  const c = (component ?? {}) as Record<string, unknown>
  const direction = typeof c['marqueeDirection'] === 'string' ? c['marqueeDirection'] : 'left'
  const speed = typeof c['marqueeSpeed'] === 'number' ? c['marqueeSpeed'] : DEFAULT_SPEED_SECONDS
  const gap = typeof c['marqueeGap'] === 'string' ? c['marqueeGap'] : undefined
  const cloneHtml = stripCloneIdentity(
    renderedChildren.map((child) => renderToStaticMarkup(child)).join('')
  )
  return (
    <div
      data-marquee="true"
      data-marquee-direction={direction}
      data-marquee-axis={resolveAxis(direction)}
      data-marquee-pause-on-hover={c['pauseOnHover'] === true ? 'true' : undefined}
      data-marquee-fade={c['marqueeFade'] === true ? 'true' : undefined}
      data-testid={elementProps['data-testid'] as string | undefined}
      id={elementProps['id'] as string | undefined}
      className={elementProps['className'] as string | undefined}
      aria-label={elementProps['aria-label'] as string | undefined}
      style={buildBandStyle(speed, gap)}
    >
      <div data-marquee-viewport="true">
        <div data-marquee-track="true">
          <div data-marquee-group="true">{renderedChildren}</div>
          <div
            data-marquee-group="true"
            aria-hidden="true"
            inert
            dangerouslySetInnerHTML={{ __html: cloneHtml }}
          />
        </div>
      </div>
      {c['pauseControl'] === true && renderPauseControl()}
    </div>
  )
}
