/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Fragment, type ReactElement } from 'react'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import {
  BREADCRUMB_ELLIPSIS_CLASSES,
  BREADCRUMB_ELLIPSIS_TRIGGER_CLASSES,
  BREADCRUMB_ITEM_CLASSES,
  BREADCRUMB_LINK_CLASSES,
  BREADCRUMB_LIST_CLASSES,
  BREADCRUMB_PAGE_CLASSES,
  BREADCRUMB_SEPARATOR_CLASSES,
} from '../../design/breadcrumb-default-classes'
import { renderIcon } from '../elements/icon-renderer'
import { resolveChildTranslation } from '../i18n/translation-handler'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { buildDropdownMenuProps } from './island-overlay-props-builders'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'

/** One crumb, as the breadcrumb renderer reads it. */
export interface CollapsibleCrumb {
  readonly label: string
  readonly href?: string
  readonly icon?: string
}

/** A trail with its middle collapsed: the crumbs drawn, and those the ellipsis stands for. */
export interface CollapsedTrail {
  readonly head: readonly CollapsibleCrumb[]
  readonly hidden: readonly CollapsibleCrumb[]
  readonly tail: readonly CollapsibleCrumb[]
}

/**
 * Keep the first crumb and the last `maxItems - 1`, collapsing the middle
 * ones: shadcn/ui's collapsed breadcrumb. A trail no longer than `maxItems`
 * keeps every crumb.
 */
export function collapseTrail(
  items: readonly CollapsibleCrumb[],
  maxItems: number | undefined
): CollapsedTrail {
  if (maxItems === undefined || items.length <= maxItems) {
    return { head: items, hidden: [], tail: [] }
  }
  const kept = maxItems - 1
  return {
    head: items.slice(0, 1),
    hidden: items.slice(1, items.length - kept),
    tail: items.slice(items.length - kept),
  }
}

/** The ellipsis glyph, with its name for a screen reader. */
const ellipsisContent = (label: string): readonly ReactElement[] => [
  <span
    key="glyph"
    aria-hidden="true"
  >
    {renderIcon({ name: 'ellipsis', size: 16, 'aria-hidden': 'true' }, [])}
  </span>,
  <span
    key="name"
    className="sr-only"
  >
    {label}
  </span>,
]

/**
 * What stands for the collapsed crumbs: an ellipsis that names them, or, with
 * `collapse: menu`, a button opening a menu of them, each going where its
 * crumb goes.
 */
export function renderCollapsedCrumbs(
  hidden: readonly CollapsibleCrumb[],
  collapse: 'ellipsis' | 'menu' | undefined,
  ctx: { readonly currentLang?: string; readonly languages?: Languages; readonly label: string }
): ReactElement {
  if (collapse !== 'menu') {
    return (
      <span
        data-slot="breadcrumb-ellipsis"
        className={BREADCRUMB_ELLIPSIS_CLASSES}
      >
        {ellipsisContent(ctx.label)}
      </span>
    )
  }
  const menu: Component = {
    type: 'dropdown-menu',
    triggerLabel: ctx.label,
    menuItems: hidden.map((crumb) => ({
      label: crumb.label,
      ...(crumb.href === undefined ? {} : { action: { type: 'navigate', path: crumb.href } }),
    })),
  }
  const glyph = (
    <span
      key="glyph"
      aria-hidden="true"
      className="flex"
    >
      {renderIcon({ name: 'ellipsis', size: 16, 'aria-hidden': 'true' }, [])}
    </span>
  )
  const props = buildDropdownMenuProps({}, {}, menu, {
    currentLang: ctx.currentLang,
    languages: ctx.languages,
    renderedChildren: [glyph],
  })
  return (
    <div
      data-island="dropdown-menu"
      data-island-props={JSON.stringify(props)}
      className="flex"
    >
      <button
        type="button"
        disabled
        aria-label={ctx.label}
        className={BREADCRUMB_ELLIPSIS_TRIGGER_CLASSES}
      >
        {glyph}
      </button>
    </div>
  )
}

interface BreadcrumbItem {
  readonly label: string
  readonly href?: string
  readonly icon?: string
}

/**
 * Renders the label content for a single crumb — either bare text or an
 * icon-prefixed inline-flex group when the schema supplied an icon name.
 *
 * `label` goes through the `$t:` resolver, so both trail forms are
 * translatable: an authored `breadcrumbItems[].label` and a derived trail's
 * `labels` map, which `breadcrumb.ts` documents as accepting a `$t:` key. A
 * string carrying no `$t:` prefix passes through untouched.
 */
function renderBreadcrumbLabel(
  item: BreadcrumbItem,
  currentLang: string | undefined,
  languages: Languages | undefined
): ReactElement | string {
  const label = resolveChildTranslation(item.label, currentLang, languages)
  if (!item.icon) return label
  const iconEl = renderIcon({ name: item.icon, size: 16, 'aria-hidden': 'true' }, [])
  return (
    <span className="inline-flex items-center gap-1">
      {iconEl}
      <span>{label}</span>
    </span>
  )
}

/**
 * Renders one crumb entry: the current page (`breadcrumb-page`, carrying
 * `aria-current="page"`), a prior segment's link (`breadcrumb-link`), or a
 * prior segment with no address, which is plain text in the muted ink.
 */
function renderBreadcrumbEntry(
  item: BreadcrumbItem,
  isCurrent: boolean,
  currentLang: string | undefined,
  languages: Languages | undefined
): ReactElement {
  const labelContent = renderBreadcrumbLabel(item, currentLang, languages)
  if (isCurrent) {
    return (
      <span
        data-slot="breadcrumb-page"
        aria-current="page"
        className={BREADCRUMB_PAGE_CLASSES}
      >
        {labelContent}
      </span>
    )
  }
  if (!item.href) return <span>{labelContent}</span>
  return (
    <a
      data-slot="breadcrumb-link"
      href={item.href}
      className={BREADCRUMB_LINK_CLASSES}
    >
      {labelContent}
    </a>
  )
}

/** The separator between two crumbs: presentation only, hidden from assistive technology. */
const breadcrumbSeparator = (separator: string): ReactElement => (
  <li
    data-slot="breadcrumb-separator"
    role="presentation"
    aria-hidden="true"
    className={BREADCRUMB_SEPARATOR_CLASSES}
  >
    {separator}
  </li>
)

/** One drawn crumb and the separator after it; the last one is the current page. */
const crumbRenderer =
  (
    lastIndex: number,
    separator: string,
    currentLang: string | undefined,
    languages: Languages | undefined
  ) =>
  (item: BreadcrumbItem, index: number): ReactElement => {
    const isCurrent = index === lastIndex
    return (
      <Fragment key={`${index}-${item.label}`}>
        <li
          data-slot="breadcrumb-item"
          className={BREADCRUMB_ITEM_CLASSES}
        >
          {renderBreadcrumbEntry(item, isCurrent, currentLang, languages)}
        </li>
        {!isCurrent && breadcrumbSeparator(separator)}
      </Fragment>
    )
  }

/** The crumb standing for the collapsed ones, and the separator after it. */
const collapsedCrumb = (content: ReactElement, separator: string): ReactElement => (
  <Fragment key="collapsed">
    <li
      data-slot="breadcrumb-item"
      className={BREADCRUMB_ITEM_CLASSES}
    >
      {content}
    </li>
    {breadcrumbSeparator(separator)}
  </Fragment>
)

/**
 * An enumerated trail's crumbs, ended by its `currentLabel` as the current
 * crumb (a derived trail has already folded its own into `breadcrumbItems`).
 * A label still holding an unresolved `$record.` token — no record bound — is
 * not a name, and draws nothing.
 */
const withCurrentCrumb = (
  items: readonly BreadcrumbItem[],
  currentLabel: string | undefined
): readonly BreadcrumbItem[] =>
  currentLabel === undefined || currentLabel.trim() === '' || currentLabel.includes('$record.')
    ? items
    : [...items, { label: currentLabel }]

/**
 * Renders the breadcrumb trail described by the page schema.
 *
 * Schema fields consumed:
 * - `breadcrumbItems[]` — ordered list of segments (label/href/icon)
 * - `separator` — character rendered between items (default '/')
 * - `currentLabel` — on an enumerated trail, drawn after the items as the current crumb
 *
 * The last item in the list is treated as the current page and rendered as
 * plain text (no link), matching the WAI-ARIA breadcrumb pattern.
 *
 * A `derive: 'path'` trail never reaches here as such: `resolveDerivedBreadcrumbs`
 * (`presentation/rendering/derived-breadcrumb-resolver.ts`) has already turned it
 * into `breadcrumbItems` while the request path was in scope. That is deliberate
 * — the two forms then share one set of markup and accessibility semantics and
 * cannot drift apart.
 *
 * THE AUTHOR'S `aria-label` WINS, and `breadcrumb.label` is the default: a SECOND
 * trail in the same document (a specimen of this type, a sub-trail inside a
 * panel) must be able to name itself, since two navigation landmarks sharing
 * one name is a defect for anyone cycling landmarks.
 */
export function renderBreadcrumb({
  elementPropsWithSpacing,
  component,
  currentLang,
  languages,
}: {
  readonly elementPropsWithSpacing: Record<string, unknown>
  readonly component?: Component
  readonly currentLang?: string
  readonly languages?: Languages
}): ReactElement {
  const comp = component as
    | {
        breadcrumbItems?: readonly BreadcrumbItem[]
        separator?: string
        maxItems?: number
        collapse?: 'ellipsis' | 'menu'
        currentLabel?: string
      }
    | undefined
  const items = withCurrentCrumb(comp?.breadcrumbItems ?? [], comp?.currentLabel)
  const separator = comp?.separator ?? '/'
  const { 'data-testid': dataTestId, ...rest } = omitInternalMarkers(elementPropsWithSpacing)
  const className = rest.className as string | undefined
  const ariaLabel =
    (rest['aria-label'] as string | undefined) ??
    resolveInterpreterString('breadcrumb.label', currentLang, languages)
  const trail = collapseTrail(items, comp?.maxItems)
  const drawn = [...trail.head, ...trail.tail]
  const crumb = crumbRenderer(drawn.length - 1, separator, currentLang, languages)
  return (
    <nav
      {...rest}
      data-slot="breadcrumb"
      aria-label={ariaLabel}
      className={className}
      data-testid={dataTestId as string | undefined}
    >
      <ol
        data-slot="breadcrumb-list"
        className={BREADCRUMB_LIST_CLASSES}
      >
        {trail.head.map(crumb)}
        {trail.hidden.length === 0
          ? undefined
          : collapsedCrumb(
              renderCollapsedCrumbs(trail.hidden, comp?.collapse, {
                currentLang,
                languages,
                label: resolveInterpreterString('breadcrumb.more', currentLang, languages),
              }),
              separator
            )}
        {trail.tail.map((item, index) => crumb(item, trail.head.length + index))}
      </ol>
    </nav>
  )
}
