/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `collapsible` anatomy (`collapsible`, `collapsible-trigger`,
 * `collapsible-content`), read by the server render of both forms and by the
 * enhancement script of the hydrated one.
 *
 * shadcn/ui's Collapsible ships no classes of its own: the trigger is whatever
 * the author puts in it. A config cannot put a button in it, so the trigger is
 * drawn as a quiet full-width row — the label, then a chevron that turns when
 * the region opens — in shadcn's own utilities.
 */

/** `collapsible`: the root, which names its state for the chevron. */
export const computeCollapsibleClasses = (): string => 'group/collapsible flex flex-col gap-2'

/** `collapsible-trigger`: the row that shows and hides the region. */
export const computeCollapsibleTriggerClasses = (): string =>
  'flex w-full cursor-pointer list-none items-center justify-between gap-2 rounded-md text-sm font-medium outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default [&::-webkit-details-marker]:hidden'

/** The chevron inside the trigger, turned while the region is open. */
export const computeCollapsibleChevronClasses = (): string =>
  'size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/collapsible:rotate-180 group-data-[state=open]/collapsible:rotate-180'

/** `collapsible-content`: the region. */
export const computeCollapsibleContentClasses = (): string => 'text-sm'
