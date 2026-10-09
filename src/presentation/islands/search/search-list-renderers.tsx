/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React from 'react'
import {
  substituteRecordVars,
  withRecordText,
} from '@/domain/models/app/pages/substitute-record-vars'
import {
  computeListDividerClasses,
  computeListItemClasses,
  computeListShellClasses,
} from '@/presentation/design/list-default-classes'
import {
  renderEmptyList,
  renderItemTemplate,
  type ItemTemplate,
  type ListRowInputs,
} from '../parts/list-item-rows'

export type { ItemTemplate }

export type ChildTemplate = readonly (ChildNode | string)[]

export interface ChildNode {
  readonly type: string
  readonly props?: Record<string, unknown>
  readonly content?: string
  readonly children?: ChildTemplate
}

/**
 * Record substitution — re-exported from the ONE implementation in
 * `@/domain/utils/substitute-record-vars`, which is `effect`-free and already
 * the browser-reachable home for helpers like this one.
 *
 * The local copy this replaces rendered an explicit `null` as the literal text
 * `null`, so a nullable column reached a search result as the word. It also had
 * no fallback chain, so `$record.title|$record.slug` was inert here while it
 * worked on the server.
 */
export { substituteRecordVars }

function substituteChildProps(
  props: Record<string, unknown> | undefined,
  record: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!props) return props
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      typeof value === 'string' ? substituteRecordVars(value, record) : value,
    ])
  )
}

export function substituteChildTemplate(
  template: ChildTemplate,
  record: Record<string, unknown>
): ChildTemplate {
  // TEXT sites read a formatted field's text (the server attached it); props keep the stored value.
  const text = withRecordText(record)
  return template.map((child) => {
    if (typeof child === 'string') return substituteRecordVars(child, text)
    return {
      ...child,
      props: substituteChildProps(child.props, record),
      content:
        typeof child.content === 'string'
          ? substituteRecordVars(child.content, text)
          : child.content,
      children: child.children ? substituteChildTemplate(child.children, record) : child.children,
    }
  })
}

// Schema type → HTML tag mapping
const TYPE_TO_TAG: Record<string, string> = {
  text: 'span',
  container: 'div',
  card: 'div',
  list: 'ul',
  li: 'li',
  link: 'a',
  button: 'button',
  image: 'img',
}

// Render child template to JSX
export function renderChild(child: ChildNode | string, key: string): React.ReactNode {
  if (typeof child === 'string') return child

  const { type: schemaType, props = {}, content, children } = child
  const type = TYPE_TO_TAG[schemaType] ?? schemaType
  const {
    id,
    className,
    'data-testid': testid,
    ...rest
  } = props as {
    id?: string
    className?: string
    'data-testid'?: string
    [key: string]: unknown
  }

  const renderedChildren = children
    ? children.map((c, i) => renderChild(c, `${key}-${i}`))
    : undefined
  const inner = content ?? renderedChildren ?? undefined

  return React.createElement(type, { key, id, className, 'data-testid': testid, ...rest }, inner)
}

interface ResultsBodyProps {
  readonly records: readonly Record<string, unknown>[]
  readonly emptyMessage?: string
  readonly itemTemplate?: ItemTemplate
  readonly childTemplate: ChildTemplate
  readonly inputs?: ListRowInputs
}

export function renderResultsBody({
  records,
  emptyMessage,
  itemTemplate,
  childTemplate,
  inputs,
}: ResultsBodyProps): React.ReactNode {
  if (records.length === 0 && emptyMessage) return renderEmptyList(emptyMessage)
  return (
    <ul className={computeListShellClasses()}>
      {records.map((record, i) =>
        itemTemplate ? (
          renderItemTemplate(itemTemplate, record, `item-${i}`, inputs)
        ) : (
          // A `childTemplate` row carries the same geometry as an
          // `itemTemplate` row — the two differ in what they render INSIDE the
          // row, not in what a row is — so both sit on the shell identically.
          <li
            key={i}
            className={`${computeListItemClasses()} ${computeListDividerClasses()}`}
          >
            {childTemplate.map((child, j) => {
              const substituted = substituteChildTemplate([child], record)[0]
              return substituted ? renderChild(substituted, `${i}-${j}`) : undefined
            })}
          </li>
        )
      )}
    </ul>
  )
}
