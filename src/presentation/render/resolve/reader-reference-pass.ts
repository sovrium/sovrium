/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page's references to the READER — `$currentUser.id` and its scalar
 * siblings — made concrete once per request, before anything reads them.
 *
 * Two places are resolved here, because neither knows who is reading:
 *
 *  - **`visibility.record` operands** (`owner eq $currentUser.id`). A record gate
 *    is matched where the record exists, as a list row is expanded or a page
 *    bound to one record is substituted (`record-visibility.ts`). What reaches
 *    that matcher is now a literal, so the gate compares the record with a value
 *    like any other. An operand naming the reader that cannot be resolved —
 *    there is no reader, or the reference is not one value — matches no record:
 *    with no reader there is no owner to compare. It becomes `in: []`, the one
 *    condition in the vocabulary no record satisfies.
 *  - **A sidebar's fetched sources** (`query: { filter: 'owner:$currentUser.id' }`).
 *    The island merges `query` into the request it makes from the browser, so a
 *    reference left there reaches the records route as literal text. Each value
 *    is substituted where the reference stands — inside a wire filter or a
 *    `field:value` shorthand alike. A source that names the reader and cannot be
 *    resolved is not fetched at all: an anonymous visitor lists nobody's rows,
 *    and is sent no reference.
 *
 * Either way the reference never reaches the document.
 */

import {
  resolveCurrentUserOperand,
  substituteCurrentUserScalars,
} from '@/domain/models/app/pages/current-user-ref'
import { pruneNodes } from './visibility-filter'
import type { Page } from '@/domain/models/app/pages'
import type { CurrentUserFacts } from '@/domain/models/app/pages/current-user-ref'
import type { FieldCondition } from '@/domain/models/app/tables/condition-operators'

type Reader = CurrentUserFacts | undefined
type Entries = Readonly<Record<string, unknown>>

const isObject = (value: unknown): value is Entries =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The condition with every operand naming the reader made concrete; by reference when none does. */
const readerCondition = (condition: FieldCondition, reader: Reader): FieldCondition => {
  const { field, ...operators } = condition
  const entries = Object.entries(operators).map(
    ([operator, operand]) =>
      [operator, operand, resolveCurrentUserOperand(operand, reader)] as const
  )
  if (entries.some(([, , resolution]) => resolution.kind === 'unresolvable')) {
    return { field, in: [] } as FieldCondition
  }
  if (entries.every(([, , resolution]) => resolution.kind === 'literal')) return condition
  return {
    field,
    ...Object.fromEntries(
      entries.map(([operator, operand, resolution]) => [
        operator,
        resolution.kind === 'resolved' ? resolution.value : operand,
      ])
    ),
  } as FieldCondition
}

/** A `visibility` object with its `record` gate resolved; by reference when unchanged. */
const readerVisibility = (visibility: unknown, reader: Reader): unknown => {
  if (!isObject(visibility) || !isObject(visibility['record'])) return visibility
  const record = visibility['record'] as FieldCondition
  const resolved = readerCondition(record, reader)
  return resolved === record ? visibility : { ...visibility, record: resolved }
}

/** The record gate on a node's root and on its `props`, resolved. */
const readerGates = (node: object, reader: Reader): object => {
  const { visibility, props } = node as { readonly visibility?: unknown; readonly props?: Entries }
  const rootGate = readerVisibility(visibility, reader)
  const propsGate = props === undefined ? undefined : readerVisibility(props['visibility'], reader)
  const propsChanged = props !== undefined && propsGate !== props['visibility']
  if (rootGate === visibility && !propsChanged) return node
  return {
    ...node,
    ...(rootGate === visibility ? {} : { visibility: rootGate }),
    ...(propsChanged ? { props: { ...props, visibility: propsGate } } : {}),
  }
}

/** The keys under which a sidebar entry or group carries a fetched source. */
const SOURCE_KEYS: ReadonlySet<string> = new Set(['source', 'childrenSource'])

/** One `query` value for this reader; `undefined` when it names the reader unresolvably. */
const readerQueryValue = (value: unknown, reader: Reader): unknown =>
  typeof value === 'string' ? substituteCurrentUserScalars(value, reader) : value

/**
 * A fetched source with every `query` value substituted for this reader, and
 * its own `childrenSource` walked. `undefined` when a value names the reader and
 * cannot be resolved: such a source is not fetched.
 */
const readerSource = (source: Entries, reader: Reader): Entries | undefined => {
  const { query } = source
  const values = isObject(query)
    ? Object.entries(query).map(
        ([key, value]) => [key, value, readerQueryValue(value, reader)] as const
      )
    : []
  if (values.some(([, , resolved]) => resolved === undefined)) return undefined
  const walked = readerSidebarValue(source, reader) as Entries
  if (values.every(([, value, resolved]) => resolved === value)) return walked
  return {
    ...walked,
    query: Object.fromEntries(values.map(([key, , resolved]) => [key, resolved])),
  }
}

/** One value of a sidebar's `groups` / `items` tree, every fetched source in it resolved. */
function readerSidebarValue(value: unknown, reader: Reader): unknown {
  if (Array.isArray(value)) {
    const walked = value.map((entry: unknown) => readerSidebarValue(entry, reader))
    return walked.every((entry, index) => entry === value[index]) ? value : walked
  }
  if (!isObject(value)) return value
  const entries = Object.entries(value).flatMap(([key, child]): (readonly [string, unknown])[] => {
    if (SOURCE_KEYS.has(key) && isObject(child) && typeof child['endpoint'] === 'string') {
      const resolved = readerSource(child, reader)
      return resolved === undefined ? [] : [[key, resolved]]
    }
    return [[key, key === 'query' ? child : readerSidebarValue(child, reader)]]
  })
  const unchanged =
    entries.length === Object.keys(value).length &&
    entries.every(([key, child]) => value[key] === child)
  return unchanged ? value : Object.fromEntries(entries)
}

/** A sidebar's groups and items with every fetched source resolved for this reader. */
const readerSidebar = (node: object, reader: Reader): object => {
  const { type, groups, items } = node as {
    readonly type?: unknown
    readonly groups?: unknown
    readonly items?: unknown
  }
  if (type !== 'sidebar') return node
  const nextGroups = readerSidebarValue(groups, reader)
  const nextItems = readerSidebarValue(items, reader)
  if (nextGroups === groups && nextItems === items) return node
  return {
    ...node,
    ...(nextGroups === groups ? {} : { groups: nextGroups }),
    ...(nextItems === items ? {} : { items: nextItems }),
  }
}

/**
 * The page with every reference to the reader resolved for this request's
 * reader, at any depth. The page comes back by reference when none is written.
 */
export function resolveReaderReferences(page: Page, reader: Reader): Page {
  const { components } = page
  if (!components || components.length === 0) return page
  const resolved = pruneNodes(components, {
    keep: () => true,
    reshape: (node) => readerSidebar(readerGates(node, reader), reader),
  })
  return resolved.every((node, index) => node === components[index])
    ? page
    : ({ ...page, components: resolved } as Page)
}
