/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `marquee` — a continuously scrolling band of children
 *.
 *
 * CSS-only: there is NO island. The band's whole behaviour — the infinite loop,
 * its direction, the pause states, and the `prefers-reduced-motion` fallback —
 * lives in the `[data-marquee-*]` rules emitted by
 * `infrastructure/css/styles/marquee-styles-generator.ts`. The only JavaScript
 * involved is the delegated `marqueePauseScript` in `page-body-scripts.tsx`, and
 * only when the author asks for an explicit `pauseControl`.
 *
 * ```
 * [data-marquee]                        root; carries data-marquee-direction
 *   └ [data-marquee-viewport]           the clipping box (inline-size container)
 *       └ [data-marquee-track]          the animated element (infinite loop)
 *           ├ [data-marquee-group]                     the real children
 *           └ [data-marquee-group][aria-hidden][inert]  the seam clone
 *   └ button                            only when `pauseControl: true`
 * ```
 *
 * ## Why the clone exists, and why it is invisible to everything but the eye
 *
 * A seamless 50% translate needs a second copy of the children to slide in behind
 * the first. That copy is a VISUAL device only: it carries `aria-hidden="true"` so
 * ASSISTIVE TECHNOLOGY announces each item exactly ONCE, and `inert` so its links
 * never appear in the tab order. `aria-hidden` alone would leave a
 * focusable-but-hidden link — the classic accessibility bug it looks like a fix
 * for. Identity attributes (`id`, `data-testid`, `data-island*`) are stripped from
 * the clone so no selector, and no island mount, can ever resolve to two elements.
 *
 * The clone IS still counted twice by text extractors that do not model ARIA —
 * including Sovrium's own SSR-built public search index, whose `extractBodyText`
 * (`application/use-cases/server/generate-search-index.ts`) drops only
 * `script`/`style`/`head` before a blunt tag strip. A marquee's item text
 * therefore appears twice in that page's indexed body. Accepted: the band carries
 * short labels (app names) whose doubling only nudges FTS ranking. Fix the
 * EXTRACTOR (skip `[aria-hidden="true"]` subtrees) rather than the clone if this
 * ever matters — the clone has to be real DOM for the loop to be seamless.
 *
 * Every field is read off `component.*` — `marqueeDirection` and friends are
 * declared at the component TOP LEVEL, and `elementProps` only ever carries
 * `props`. Reading `elementProps.marqueeDirection` is exactly how a component's
 * top-level flags end up inert.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentRenderer } from './component-dispatch-config'
import type { CSSProperties, ReactElement } from 'react'

/** Seconds for one full loop when the author does not set `marqueeSpeed`. */
const DEFAULT_SPEED_SECONDS = 30

/** Accessible name + visible label of the optional pause control. */
const PAUSE_LABEL = 'Pause'
/** Label the control flips to once the band is stopped. */
const RESUME_LABEL = 'Resume'

/** Pause-control chrome. Class-based; the band never writes an inline style. */
const PAUSE_BUTTON_CLASSES =
  'border-border bg-background text-foreground rounded-md border px-2 py-1 text-sm'

/**
 * Attributes that must not survive into the seam clone: an `id` or `data-testid`
 * would make a unique selector resolve to two elements, and a `data-island*`
 * marker would make the island client mount a second, orphaned copy of an
 * interactive child. React escapes `"` inside attribute values to `&quot;`, so
 * `[^"]*` cannot run past the closing quote even for the JSON-bearing
 * `data-island-props`.
 */
const CLONE_IDENTITY_ATTRS_RE = /\s(?:id|data-testid|data-island[\w-]*)="[^"]*"/g

/** Strip identity attributes from the cloned group's static markup. */
function stripCloneIdentity(html: string): string {
  return html.replace(CLONE_IDENTITY_ATTRS_RE, '')
}

/**
 * Resolve the scroll axis. `left`/`right` scroll horizontally, `up`/`down`
 * vertically — the axis selects which keyframe set the track animates, and the
 * direction selects whether it plays forwards or in reverse.
 */
function resolveAxis(direction: string): 'x' | 'y' {
  return direction === 'up' || direction === 'down' ? 'y' : 'x'
}

/**
 * Build the band's inline custom properties. These are the ONLY two values the
 * stylesheet cannot know statically. `marqueeGap` is pattern-restricted by
 * `MarqueeGapSchema` (a bare `0` or a number with a `px`/`rem`/`em`/`%` unit), so
 * interpolating it into a custom property is not an injection surface.
 */
function buildBandStyle(speedSeconds: number, gap: string | undefined): CSSProperties {
  return {
    '--sv-marquee-duration': `${speedSeconds}s`,
    ...(gap !== undefined ? { '--sv-marquee-gap': gap } : {}),
  } as CSSProperties
}

/**
 * The explicit pause/resume control (`pauseControl: true`). A real `<button>`,
 * not a div with a handler, so it is reachable and operable by keyboard and
 * announced as a control. Both labels ride on the element so the delegated
 * script needs no configuration of its own.
 */
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

/** `marquee` renderer — see the module doc for the DOM contract. */
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
            // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR one-shot; the clone is pre-rendered markup from the same tree
            dangerouslySetInnerHTML={{ __html: cloneHtml }}
          />
        </div>
      </div>
      {c['pauseControl'] === true && renderPauseControl()}
    </div>
  )
}
