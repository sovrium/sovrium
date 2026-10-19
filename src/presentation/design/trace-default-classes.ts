/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui trace (https://ui.shadcn.com), registry commit 4233ed1caded.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `trace` anatomy, as base-nova draws it: one class string per
 * `data-slot`. Trace is internal anatomy — the lines an `ai-chat` answer draws
 * for the agent at work (a tool it calls, its reasoning, a call held for the
 * reader), never a component type an author places.
 *
 * A line names where it stands in `data-status`: `running` shimmers its title
 * (and stops under reduced motion, which the `shimmer` utility honours on its
 * own), `error` paints it destructive, and a settled line carries no status.
 * Two departures from upstream, both for a line that holds the reader's own
 * controls: a `pending` line is not dimmed, since it holds Approve and Deny,
 * and the collapsible opens with no height transition, since the panel is
 * drawn without Base UI's measured `--collapsible-panel-height`.
 */

/** `trace`: the column of lines an answer opens with. */
const TRACE = 'flex w-full min-w-0 flex-col gap-2'

/** `trace-line`: one line, its status painting it. */
const TRACE_LINE =
  'flex w-fit max-w-full min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground transition-colors data-[status=error]:text-destructive data-[status=running]:*:data-[slot=trace-title]:shimmer'

/** `trace-icon`: the glyph at the start of a line, and the chevron of a trigger. */
const TRACE_ICON =
  "flex size-4 shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"

/** `trace-title`: what the line is about. */
const TRACE_TITLE = 'min-w-0 truncate motion-reduce:shimmer-none'

/** `trace-description`: where it stands, in words. */
const TRACE_DESCRIPTION = 'text-muted-foreground/70 tabular-nums'

/** `trace-collapsible-trigger`: the part of a line that opens it. */
const TRACE_COLLAPSIBLE_TRIGGER =
  'group/trace-collapsible-trigger flex w-fit max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-md text-left text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50'

/** The chevron of a trigger, turned while the line is open. */
const TRACE_COLLAPSIBLE_CHEVRON =
  'transition-transform group-aria-expanded/trace-collapsible-trigger:rotate-90'

/** `trace-collapsible-content`: what an open line shows, ruled off at its start. */
const TRACE_COLLAPSIBLE_CONTENT =
  'mt-1 mb-1 ml-[calc(--spacing(2)-1px)] min-w-0 basis-full border-l pr-1 pl-4 leading-relaxed wrap-break-word whitespace-pre-wrap text-muted-foreground'

/** The column of lines an answer opens with. */
export const computeTraceClasses = (): string => TRACE

/** One line of the trace. */
export const computeTraceLineClasses = (): string => TRACE_LINE

/** The glyph at the start of a line. */
export const computeTraceIconClasses = (): string => TRACE_ICON

/** What a line is about. */
export const computeTraceTitleClasses = (): string => TRACE_TITLE

/** Where a line stands, in words. */
export const computeTraceDescriptionClasses = (): string => TRACE_DESCRIPTION

/** The part of a line that opens it. */
export const computeTraceCollapsibleTriggerClasses = (): string => TRACE_COLLAPSIBLE_TRIGGER

/** The chevron of a trigger. */
export const computeTraceCollapsibleChevronClasses = (): string =>
  `${TRACE_ICON} ${TRACE_COLLAPSIBLE_CHEVRON}`

/** What an open line shows. */
export const computeTraceCollapsibleContentClasses = (): string => TRACE_COLLAPSIBLE_CONTENT
