/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveClasses } from '@/presentation/design/resolve-classes'
import { computeTocLinkClasses } from '../../design/navigation-default-classes'
import type { ComponentDispatchConfig, ComponentRenderer } from './component-dispatch-config'
import type { TocHeading } from '@/presentation/render/resolve/toc-resolver'
import type { ReactElement } from 'react'

/**
 * Renderer for `{ type: 'toc' }` — auto-generated table of contents.
 *
 * The schema author writes ONLY `{ type: 'toc' }` (optionally `props.sticky: true`
 * for a sidebar-style sticky TOC). The page-level `resolvePageToc` pass
 * (see {@link "../../../../rendering/toc-resolver"}) walks the full component
 * tree, assigns deterministic anchor ids to every heading component, and
 * attaches the collected `TocHeading[]` to this component as a render-time
 * `tocHeadings` field (sibling of `props`). This renderer reads that field and
 * emits a `<nav>` of `<a href="#id">` links — one per heading, in document
 * order — so native browser anchor scrolling drives navigation without any
 * client-side JavaScript.
 *
 * Sticky variant — when `props.sticky === true`, the wrapping `<nav>` gets
 * `sticky top-0` Tailwind classes; combined with the spec's typical
 * `<aside class="w-64 shrink-0">` parent in a `flex` container, the TOC
 * stays in view while the long article scrolls.
 *
 * No headings → no nav. We emit an empty `<nav role="navigation">` so the
 * page locator still resolves (matching how empty sections render) without
 * a visible empty box.
 */
export const tocComponent: ComponentRenderer = (config: ComponentDispatchConfig): ReactElement => {
  const component = config.component as
    | { readonly tocHeadings?: readonly TocHeading[]; readonly props?: Record<string, unknown> }
    | undefined
  const headings = component?.tocHeadings ?? []
  const sticky = component?.props?.['sticky'] === true

  const {
    'data-testid': dataTestId,
    sticky: _sticky,
    ...restProps
  } = config.elementPropsWithSpacing as Record<string, unknown>
  const userClassName = restProps['className'] as string | undefined
  const stickyClasses = sticky ? 'sticky top-0 self-start' : ''
  const baseClasses = 'text-md'
  const className = resolveClasses(
    [baseClasses, stickyClasses].filter(Boolean).join(' '),
    userClassName
  )

  // Strip className from rest so we don't double-set it.
  const { className: _cn, ...nonClassProps } = restProps

  return (
    <nav
      {...nonClassProps}
      aria-label="Table of contents"
      className={className}
      data-testid={dataTestId as string | undefined}
    >
      <ul className="m-0 list-none space-y-1 p-0">
        {headings.map((heading) => {
          // Indent by level so h2 sits flush, h3 is indented once, etc.
          // h1 is treated the same as h2 visually (TOC root level) because
          // documentation pages typically have one h1 (the page title) and
          // the TOC navigates the h2+ structure.
          const indent = heading.level <= 2 ? 0 : heading.level - 2
          const indentClass = indent === 0 ? '' : `pl-${indent * 4}`
          return (
            <li
              key={heading.id}
              data-toc-level={heading.level}
              className={indentClass}
            >
              <a
                href={`#${heading.id}`}
                className={computeTocLinkClasses()}
              >
                {heading.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
