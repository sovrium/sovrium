/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import type { CollectionNavEntry } from '@/presentation/rendering/content-dir-lister'
import type { DocsRootCrumb } from '@/presentation/ui/pages/markdown/DocsRootCrumb'

interface DocsArticleBreadcrumbProps {
  readonly current: CollectionNavEntry
  readonly rootCrumb: DocsRootCrumb | undefined
  readonly homeLabel: string
}

const crumbLinkClass =
  'text-foreground-subtle hover:text-foreground transition-colors duration-150 no-underline'

const deriveHomeHref = (href: string): string => {
  const match = href.match(/^\/([^/]+)\//)
  return match ? `/${match[1]}/` : '/'
}

const buildLeadingCrumbs = (
  current: CollectionNavEntry,
  rootCrumb: DocsRootCrumb | undefined,
  homeLabel: string
): readonly { readonly key: string; readonly node: ReactElement }[] => {
  const sectionLabel = current.groupLabel
  const rootSelfLinks = rootCrumb !== undefined && rootCrumb.href === current.href
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
      className="min-w-0 flex-1 text-xs"
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
