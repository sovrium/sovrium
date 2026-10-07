/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  resolveInterpreterString,
  resolveInterpreterStringOverrides,
} from '@/domain/models/app/languages/translation-resolver'
import { computeListShellClasses } from '@/presentation/design/list-default-classes'
import { declaredListRowClasses } from '@/presentation/design/list-row-class-resolution'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  hostClassName,
  hostComponentType,
} from '@/presentation/render/registry/island-host-attributes'
import { isAccountSessionsSource } from '@/presentation/render/resolve/auth-source-binding'
import type { Languages } from '@/domain/models/app/languages'
import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'
import type { ReactElement } from 'react'

export interface ListDisplayProps {
  readonly itemTemplate?: Record<string, unknown>
  readonly emptyMessage?: string
  readonly loadMore?: string
  readonly highlight?: boolean
  readonly maxItems?: number
  readonly itemLayout?: string
  readonly hideWhenEmpty?: boolean
}

/**
 * Reads the `_listDisplay` prop into its declarative config. Both resolvers
 * (`data-source-rows.ts`, `data-source-modes.ts`) stamp it as an OBJECT, never
 * a JSON string, so the props translation pass has already resolved its `$t:`
 * keys by the time it lands here — one shape, no second spelling to drift.
 */
export function parseListDisplay(raw: unknown): ListDisplayProps | undefined {
  return typeof raw === 'object' && raw !== null ? (raw as ListDisplayProps) : undefined
}

/**
 * Renders the `list` island placeholder for a CLIENT-fetching data-bound list
 * (CAP-1). The resolver stamped `_listIslandMode` + `_listDataSource` (the DB
 * table OR system read endpoint) + `_listDisplay`; this host forwards them to
 * the island, which fetches its rows and renders the `itemTemplate`. A system
 * source is read-only — no write affordances are emitted.
 */
/** The active page language and app translations, for the engine's own strings. */
export interface EngineLocale {
  readonly currentLang: string | undefined
  readonly languages: Languages | undefined
}

/** `hideWhenEmpty` for the island payload, present only when the list declares it. */
const hideWhenEmptyProp = (
  listDisplay: ListDisplayProps | undefined
): { readonly hideWhenEmpty?: true } =>
  listDisplay?.hideWhenEmpty === true ? { hideWhenEmpty: true } : {}

/**
 * SSR skeleton: VISIBLE pulse rows before island hydration so the host has a
 * non-zero box (Playwright treats an empty/zero-height host as hidden).
 * Skeleton rows are `<div>` (not `<li>`) so `#id li` resolves to the hydrated
 * itemTemplate items only. The island replaces this host's children on mount.
 * A list that hides when empty draws no skeleton: the notice it carries must
 * not flash a box before its rows are known.
 */
function renderListSkeleton(
  listDisplay: ListDisplayProps | undefined,
  shell: { readonly listClasses?: string },
  { currentLang, languages }: EngineLocale
): ReactElement | undefined {
  if (listDisplay?.hideWhenEmpty === true) return undefined
  return (
    <div
      role="status"
      aria-label={resolveInterpreterString('list.loading', currentLang, languages)}
      className={`${shell.listClasses ?? computeListShellClasses()} space-y-2 p-2`}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`list-skeleton-${String(i)}`}
          className="bg-background-subtle h-6 w-full animate-pulse rounded"
        />
      ))}
    </div>
  )
}

/**
 * The `listClasses` island prop: the shell `<ul>`'s classes with the author's
 * `list` part merged over the recipe and the part's floor last — present only
 * when the list declares that part, so an undeclared list serialises what it
 * always did.
 */
const declaredListShellClasses = (
  styles: Pick<ComponentDesignResolution, 'parts' | 'partFloors'> | undefined
): { readonly listClasses?: string } => {
  const declared = styles?.parts['list']
  if (declared === undefined) return {}
  return {
    listClasses: resolveClasses(
      computeListShellClasses(),
      declared,
      undefined,
      styles?.partFloors['list']
    ),
  }
}

export function renderListIsland(
  elementProps: Record<string, unknown>,
  { currentLang, languages }: EngineLocale,
  styles: Pick<ComponentDesignResolution, 'parts' | 'partFloors'> | undefined
): ReactElement {
  const parts = styles?.parts
  const shell = declaredListShellClasses(styles)
  const listDisplay = parseListDisplay(elementProps['_listDisplay'])
  const dataSource = JSON.parse((elementProps['_listDataSource'] as string) ?? '{}') as unknown
  // The table-derived inputs (`list-island-inputs.ts`): currencies, and the
  // other facts about the bound fields a row prints the way a grid row does.
  const inputs = JSON.parse((elementProps['_listInputs'] as string) ?? '{}') as object
  const islandProps = JSON.stringify({
    ...inputs,
    dataSource,
    itemTemplate: listDisplay?.itemTemplate,
    // The paging affordance. Without this line the island cannot know a control
    // was asked for, so `listDisplay.loadMore` had no reader on this path at all
    // and a paged list ended silently at its first page.
    loadMore: listDisplay?.loadMore,
    emptyMessage: listDisplay?.emptyMessage,
    // How many rows the list is allowed to DRAW. Without this line the island
    // never learns the cap was declared, so `listDisplay.maxItems` had no reader
    // anywhere and an author who capped a list got the whole collection.
    maxItems: listDisplay?.maxItems,
    // A list that draws nothing until it has a row: no skeleton, no empty state.
    ...hideWhenEmptyProp(listDisplay),
    // `listDisplay.itemLayout`, and the author's classes for the row's parts
    // (`design.components.list` under the instance's own `classes`).
    ...declaredListRowClasses(listDisplay?.itemLayout, parts),
    // The shell `<ul>`'s classes, when the author styles its `list` part.
    ...shell,
    // The list's loading and failure chrome in the page language, sent only
    // where it differs from the English the island is written in.
    uiStrings: resolveInterpreterStringOverrides(['list.', 'rateLimit.'], currentLang, languages),
    // The list's accessible name, which only the island's `<ul>` can carry, and
    // whether its items are the reader's sessions (each then marked current or not).
    ariaLabel: elementProps['aria-label'],
    accountSessions: isAccountSessionsSource(dataSource),
  })
  return (
    <div
      id={elementProps['id'] as string | undefined}
      data-island="list"
      data-component="list"
      data-component-type={hostComponentType(elementProps)}
      className={hostClassName(elementProps)}
      // On the HOST rather than inside the island payload, where nothing could
      // read it: the island returns a fragment, so it has no
      // single element of its own to name, and the host is the element that is
      // there before hydration and still there after. It is also where the two
      // other data islands put theirs, so one selector addresses any of them.
      data-testid={elementProps['data-testid'] as string | undefined}
      data-island-props={islandProps}
    >
      {renderListSkeleton(listDisplay, shell, { currentLang, languages })}
    </div>
  )
}
