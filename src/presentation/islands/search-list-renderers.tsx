/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React from 'react'

export type ChildTemplate = readonly (ChildNode | string)[]

export interface ChildNode {
  readonly type: string
  readonly props?: Record<string, unknown>
  readonly content?: string
  readonly children?: ChildTemplate
}

export interface ItemTemplate {
  readonly title?: string
  readonly subtitle?: string
  readonly image?: string
  readonly badge?: string
  readonly metadata?: readonly { readonly field: string; readonly format?: string }[]
}

export function substituteRecordVars(text: string, record: Record<string, unknown>): string {
  return text.replace(/\$record\.([a-zA-Z0-9_]+)/g, (_, fieldName: string) => {
    const value = record[fieldName]
    return value !== undefined ? String(value) : ''
  })
}

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
  return template.map((child) => {
    if (typeof child === 'string') return substituteRecordVars(child, record)
    return {
      ...child,
      props: substituteChildProps(child.props, record),
      content:
        typeof child.content === 'string'
          ? substituteRecordVars(child.content, record)
          : child.content,
      children: child.children ? substituteChildTemplate(child.children, record) : child.children,
    }
  })
}

const TYPE_TO_TAG: Record<string, string> = {
  text: 'span',
  container: 'div',
  card: 'div',
  list: 'ul',
  li: 'li',
  link: 'a',
  button: 'button',
  image: 'img',
  hero: 'div',
}

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

function renderItemMetadata(
  metadata: ItemTemplate['metadata'],
  record: Record<string, unknown>,
  key: string
): React.ReactNode {
  return metadata?.map((meta, i) => {
    const value = record[meta.field]
    if (value === undefined) return undefined
    return (
      <span
        key={`${key}-meta-${i}`}
        data-list-meta={meta.field}
      >
        {String(value)}
      </span>
    )
  })
}

function renderItemTemplate(
  template: ItemTemplate,
  record: Record<string, unknown>,
  key: string
): React.ReactNode {
  const sub = (field?: string) => (field ? substituteRecordVars(field, record) : undefined)
  const title = sub(template.title)
  const image = sub(template.image)
  return (
    <li
      key={key}
      data-list-item="true"
    >
      {image ? (
        <img
          src={image}
          alt={title ?? ''}
        />
      ) : undefined}
      {title ? <span data-list-title="true">{title}</span> : undefined}
      {sub(template.subtitle) ? (
        <span data-list-subtitle="true">{sub(template.subtitle)}</span>
      ) : undefined}
      {sub(template.badge) ? <span data-list-badge="true">{sub(template.badge)}</span> : undefined}
      {renderItemMetadata(template.metadata, record, key)}
    </li>
  )
}

interface ResultsBodyProps {
  readonly records: readonly Record<string, unknown>[]
  readonly emptyMessage?: string
  readonly itemTemplate?: ItemTemplate
  readonly childTemplate: ChildTemplate
}

export function renderResultsBody({
  records,
  emptyMessage,
  itemTemplate,
  childTemplate,
}: ResultsBodyProps): React.ReactNode {
  if (records.length === 0 && emptyMessage) {
    return <p data-list-empty="true">{emptyMessage}</p>
  }
  return (
    <ul>
      {records.map((record, i) =>
        itemTemplate ? (
          renderItemTemplate(itemTemplate, record, `item-${i}`)
        ) : (
          <li key={i}>
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
