/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { DocsRootCrumb } from '@/presentation/render/markdown/docs-root-crumb'
import type { CollectionNavEntry } from '@/presentation/render/resolve/content-dir-lister'

/**
 * The docs-article breadcrumb (`<nav aria-label="Breadcrumb">`).
 *
 * Root crumb (position 1):
 *   - `rootCrumb` PRESENT (a ZONED Sovrium-docs collection) → the active zone tab
 *     (label linking to the zone's landing article), UNLESS it self-links this
 *     very page (the zone's first article) — the SELF-LINK collapse then drops the
 *     root crumb so no breadcrumb link points back at the current page.
 *   - `rootCrumb` ABSENT (non-zoned / generic docs) → the historical language-home
 *     "Home" link (graceful degradation).
 *
 * Section crumb: the middle section crumb is DROPPED when its label equals the
 * resolved zone-tab name (the REDUNDANCY collapse — so it never reads
 * "Tables / Tables / Field Types").
 *
 * It is a `<nav>` + `<ol>`, never a heading, so the single-`<h1>` document-outline
 * invariant is preserved.
 */
interface DocsArticleBreadcrumbProps {
  /** The current (active) collection entry being rendered. */
  readonly current: CollectionNavEntry
  /** The resolved zone-tab root crumb, or `undefined` for non-zoned collections. */
  readonly rootCrumb: DocsRootCrumb | undefined
  /** Breadcrumb "Home" label for the non-zoned fallback. */
  readonly homeLabel: string
}

const crumbLinkClass =
  'text-foreground-subtle hover:text-foreground transition-colors duration-150 no-underline'

/**
 * Derive the language-home href (`/en/`, `/fr/`, …) from the current entry's
 * resolved href (`/en/license` → `/en/`). Returns `/` when the href has no
 * leading language segment.
 */
const deriveHomeHref = (href: string): string => {
  const match = href.match(/^\/([^/]+)\//)
  return match ? `/${match[1]}/` : '/'
}

/** Build the leading crumbs (root + optional section) in order, keyed for React. */
const buildLeadingCrumbs = (
  current: CollectionNavEntry,
  rootCrumb: DocsRootCrumb | undefined,
  homeLabel: string
): readonly { readonly key: string; readonly node: ReactElement }[] => {
  const sectionLabel = current.groupLabel
  // The zone root self-links this page when it IS the zone's first article; drop
  // it so no crumb links back to the current page.
  const rootSelfLinks = rootCrumb !== undefined && rootCrumb.href === current.href
  // Drop the middle section crumb when it duplicates the zone-tab name.
  const sectionRedundant =
    rootCrumb !== undefined && sectionLabel !== undefined && sectionLabel === rootCrumb.name

  const rootCrumbEntry =
    rootCrumb === undefined
      ? [
          {
            key: 'root-home',
            node: (
              <a
                href={deriveHomeHref(current.href)}
                className={crumbLinkClass}
              >
                {homeLabel}
              </a>
            ),
          },
        ]
      : rootSelfLinks
        ? []
        : [
            {
              key: 'root-zone',
              node: (
                <a
                  href={rootCrumb.href}
                  className={crumbLinkClass}
                >
                  {rootCrumb.name}
                </a>
              ),
            },
          ]

  const sectionEntry =
    sectionLabel !== undefined && !sectionRedundant
      ? [{ key: 'section', node: <span className="text-foreground-muted">{sectionLabel}</span> }]
      : []

  return [...rootCrumbEntry, ...sectionEntry]
}

export function DocsArticleBreadcrumb({
  current,
  rootCrumb,
  homeLabel,
}: DocsArticleBreadcrumbProps): Readonly<ReactElement> {
  const leadingCrumbs = buildLeadingCrumbs(current, rootCrumb, homeLabel)
  return (
    <nav
      aria-label="Breadcrumb"
      className="min-w-0 flex-1 text-sm"
    >
      <ol className="text-foreground-subtle flex min-w-0 list-none flex-nowrap items-center gap-1.5 overflow-hidden">
        {leadingCrumbs.map((crumb) => (
          <li
            key={crumb.key}
            className="flex items-center gap-1.5"
          >
            {crumb.node}
            <span aria-hidden="true">/</span>
          </li>
        ))}
        <li
          aria-current="page"
          className="text-foreground min-w-0 truncate"
        >
          {current.label}
        </li>
      </ol>
    </nav>
  )
}
