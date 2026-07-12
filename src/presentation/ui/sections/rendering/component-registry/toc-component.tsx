/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTocLinkClasses } from '../../renderers/element-renderers/recipes/navigation-default-classes'
import type { ComponentDispatchConfig, ComponentRenderer } from '../component-dispatch-config'
import type { TocHeading } from '@/presentation/rendering/toc-resolver'
import type { ReactElement } from 'react'

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
  const userClassName = (restProps['className'] as string | undefined) ?? ''
  const stickyClasses = sticky ? 'sticky top-0 self-start' : ''
  const baseClasses = 'text-sm'
  const className = [baseClasses, stickyClasses, userClassName].filter(Boolean).join(' ')

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
