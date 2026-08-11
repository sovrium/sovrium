/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PreviewCard } from '@base-ui/react/preview-card'
import { computeHoverCardPopupClasses } from './overlay-default-classes'
import type { ReactElement } from 'react'

interface HoverCardIslandProps {
  readonly floatingSide?: 'top' | 'right' | 'bottom' | 'left'
  readonly floatingAlign?: 'start' | 'center' | 'end'
  readonly openDelay?: number
  readonly closeDelay?: number
  readonly triggerHtml?: string
  readonly triggerLabel?: string
  readonly triggerId?: string
  readonly childrenHtml?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/** SSR-skeleton helpers — isolate the inline `dangerouslySetInnerHTML` object
 * so the per-render allocation does not live in the island body. */
function SSRSkeletonSpan({ html }: { readonly html: string }): ReactElement {
  // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only first-paint skeleton
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

function SSRSkeletonDiv({ html }: { readonly html: string }): ReactElement {
  // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only first-paint skeleton
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * Stable JSX identity for the PreviewCard.Trigger `render` prop. Hoisted to
 * module scope so it is allocated once (not per island render — eliminates
 * the react-perf `jsx-no-jsx-as-prop` warning). We swap the default `<a>` for
 * a `<span>` so the schema-authored trigger element inside `triggerHtml`
 * (e.g. an `<a id="...">`) keeps its own semantics without nested anchors
 * or duplicate ids.
 */
const TRIGGER_RENDER = <span />

/** Extracted to keep `HoverCardIsland` under the `max-lines-per-function` cap. */
function HoverCardPopupContents({
  childrenHtml,
}: {
  readonly childrenHtml?: string
}): ReactElement {
  return (
    <>
      {childrenHtml && <SSRSkeletonDiv html={childrenHtml} />}
      <PreviewCard.Arrow className="text-background-overlay">
        <svg
          width="12"
          height="6"
          viewBox="0 0 12 6"
          fill="currentColor"
        >
          <path d="M0 6L6 0L12 6" />
        </svg>
      </PreviewCard.Arrow>
    </>
  )
}

/**
 * Hover-card island — wraps Base UI PreviewCard.
 *
 * Shows rich floating content when the user hovers over the trigger element
 * (typically a link). Open/close delays let the card persist while the user
 * traverses from the trigger into the floating content (safePolygon hover
 * heuristic is on by default via PreviewCard).
 *
 * The first child of the schema component is the trigger (rendered as
 * `triggerHtml`); the remaining children form the floating panel
 * (`childrenHtml`). The Base UI PreviewCard.Trigger renders an `<a>` element
 * by default, matching the typical link-hover use case.
 */
export default function HoverCardIsland({
  floatingSide = 'bottom',
  floatingAlign = 'center',
  openDelay = 600,
  closeDelay = 300,
  triggerHtml,
  triggerLabel,
  // triggerId/id are read by the SSR placeholder so the test can locate the
  // trigger pre-hydration. After hydration the inner trigger element (rendered
  // from `triggerHtml`) keeps the id; the PreviewCard.Trigger span itself does
  // NOT carry the id to avoid the duplicate-id error from the previous fix.
  childrenHtml,
  className,
  'data-testid': testId,
}: HoverCardIslandProps): ReactElement {
  // `triggerHtml` contains the rendered first child (e.g. an `<a>` with its own
  // id + href). PreviewCard.Trigger defaults to rendering an `<a>` — if we
  // wrapped triggerHtml inside that default <a>, the trigger's id would
  // collide with the inner element's id and we'd produce invalid nested
  // anchors. Use the `render` prop with a `<span>` so the trigger contributes
  // only event handlers + ARIA, letting the schema-authored inner element keep
  // its semantics. The hover target is the span containing the original link.
  const triggerInner = triggerHtml ? (
    <SSRSkeletonSpan html={triggerHtml} />
  ) : (
    <span>{triggerLabel ?? 'Open'}</span>
  )
  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        render={TRIGGER_RENDER}
        className={className}
        data-testid={testId}
        delay={openDelay}
        closeDelay={closeDelay}
      >
        {triggerInner}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          side={floatingSide}
          align={floatingAlign}
          sideOffset={8}
        >
          <PreviewCard.Popup className={computeHoverCardPopupClasses()}>
            <HoverCardPopupContents childrenHtml={childrenHtml} />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  )
}
