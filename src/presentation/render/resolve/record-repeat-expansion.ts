/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `repeat` on a page bound to ONE record, expanded on the SERVER.
 *
 * A page bound by `{ table, mode: 'single' }` or `{ system }` has its record
 * before the first byte is written, and that record often carries arrays. The
 * binding pass (`page-system-record-binding.ts`) therefore expands a `repeat`
 * there itself, so the copies are in the first response like every other
 * `$record.` value on the page — where the drawer, which learns its record only
 * after a click, has to do the same thing in the browser
 * (`islands/overlays/record-drawer-repeat.ts`).
 *
 * ─── ONE CONTRACT ON BOTH SIDES ────────────────────────────────────────────
 *
 * The two expansions resolve the same tokens in the same places — a copy's
 * `content`, its string children and its `data-*` props — against the same
 * scopes (the server adds the typed keys below, which the drawer receives
 * already drawn as text):
 *
 *  - without `as`, `$record.<key>` reads the ELEMENT (the page record is out of
 *    reach inside the copy, exactly as in the drawer);
 *  - with `as: 'leg'`, `$leg.<key>` reads the element and `$record.<key>` keeps
 *    reading the page record;
 *  - `record` names a field of the NEAREST record in scope — the enclosing
 *    repeat's element, else the page record — which is what lets a leg iterate
 *    its own `stops`.
 *
 * ─── THE TYPED KEYS A COPY ALSO RESOLVES, SERVER-SIDE ─────────────────────
 *
 * A copy's own sentences — `title`, `description`, `label` — resolve as TEXT,
 * as its `content` does: an `item` row per step reads `$step.name` in its title.
 * Its `href`, `src` and `alt`, on the node or in its props, take the stored
 * value, exactly as `$record.` fills those props on a bound page — the same
 * destination with the same rule, so a value is no more trusted inside a copy
 * than outside one. A `description-list`'s pairs resolve as they do on a bound
 * page: `term` and `detail` as text, `action.href` as the stored value, and a
 * formatted lone-token detail as the element's stored value. Every other prop
 * keeps its tokens verbatim. Widening that
 * further is a per-destination escaping question (a `style` can name a `url(`),
 * not a loosened key filter.
 *
 * ─── THE PER-ELEMENT GATE ─────────────────────────────────────────────────
 *
 * A node under a copy declaring `visibility.item` is kept only when the element
 * the copy is drawn from satisfies it — the nearest enclosing repeat's element,
 * at any depth of the copy — and is otherwise left out of the HTML with its
 * subtree, as `visibility.record` leaves a node out of a row.
 *
 * ─── A VALUE IS TEXT, NEVER MARKUP (standing rule S2) ─────────────────────
 *
 * All substitution goes through `substituteScopedVars` in ONE pass per string,
 * so a value is never scanned again for tokens. A text template's value is
 * pinned to the text branch when it would begin with `<`, and an author's HTML
 * template has each VALUE HTML-escaped — `substituteScopesInContent`, the one
 * place that decision is taken, for a bound page and a copy alike.
 *
 * ─── THE ONE PLACE AN OBJECT PRINTS ───────────────────────────────────────
 *
 * An object-valued token otherwise survives as its own literal text
 * (`repeatElementScalars`, `printableRecordFields`). A `code` node whose WHOLE
 * content is exactly one scoped token is the exception: an object or an array
 * prints as 2-space-indented JSON. It is always text — a `code` node renders its
 * content as children — and a token mixed with any other text stays literal.
 */

import {
  RECORD_NAMESPACE,
  printableRecordFields,
  repeatElementScalars,
  substituteScopedVars,
  withScopesText,
} from '@/domain/models/app/pages/substitute-record-vars'
import { substituteScopesInContent, withPlainTextPin } from './record-substitution'
import { filterChildrenForElement } from './record-visibility'
import type { Component } from '@/domain/models/app/pages/components'

type Fields = Readonly<Record<string, unknown>>

/** What a copy resolves against: the printable view, the raw view, and the nearest record. */
export interface RecordScope {
  /** Per namespace, the fields a token may PRINT (object values mapped to their own token). */
  readonly printable: Readonly<Record<string, Fields>>
  /** Per namespace, the raw fields — read only by the lone-token JSON rule. */
  readonly raw: Readonly<Record<string, Fields>>
  /** The record a nested `repeat.record` names a field of. */
  readonly nearest: unknown
}

const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The scope a page bound to `record` starts from. */
export const pageRecordScope = (record: Fields): RecordScope => ({
  printable: { [RECORD_NAMESPACE]: printableRecordFields(record) },
  raw: { [RECORD_NAMESPACE]: record },
  nearest: record,
})

/** The scope one copy of a repeat resolves against. */
function elementScope(scope: RecordScope, as: string | undefined, element: unknown): RecordScope {
  const namespace = as ?? RECORD_NAMESPACE
  return {
    printable: { ...scope.printable, [namespace]: repeatElementScalars(element, namespace) },
    raw: { ...scope.raw, [namespace]: isFields(element) ? element : {} },
    nearest: element,
  }
}

/**
 * A value with every object's keys in code-point order, arrays untouched.
 *
 * The order a record's keys arrive in is the STORE's, not the author's: SQLite
 * keeps a `json` column's insertion order, and PostgreSQL's `jsonb` re-orders by
 * key length. Sorting makes the printed block the same on both dialects, and the
 * same from one read to the next.
 */
const withSortedKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withSortedKeys)
  if (!isFields(value) || Object.getPrototypeOf(value) !== Object.prototype) return value
  return Object.fromEntries(
    Object.keys(value)
      .toSorted()
      .map((key) => [key, withSortedKeys(value[key])])
  )
}

/** A string that is exactly one unescaped scoped token: its namespace and its dotted path. */
const LONE_TOKEN = /^\$([a-zA-Z_][a-zA-Z0-9_]*)((?:\.[a-zA-Z0-9_]+)+)$/

/**
 * The raw value a string names when it is exactly one scoped token — its path
 * walked through plain objects — or `undefined` when it is not one.
 */
function loneTokenValue(text: string, scope: RecordScope): unknown {
  const [, namespace = '', path = ''] = LONE_TOKEN.exec(text) ?? []
  return path
    .slice(1)
    .split('.')
    .reduce<unknown>(
      (value, key) => (isFields(value) ? value[key] : undefined),
      path === '' ? undefined : scope.raw[namespace]
    )
}

/**
 * The JSON a `code` node prints when its whole content is one scoped token whose
 * value is an object or an array, or `undefined` when the rule does not apply.
 */
function loneTokenJson(content: unknown, scope: RecordScope): string | undefined {
  const value = typeof content === 'string' ? loneTokenValue(content, scope) : undefined
  return typeof value === 'object' && value !== null
    ? JSON.stringify(withSortedKeys(value), undefined, 2)
    : undefined
}

/**
 * What the page binding pass reads off its scope for one component: the fields
 * `$record.` may print, and the JSON a lone-token `code` node prints instead.
 * Without a scope — a collection page — the record prints as it always has.
 */
export function pageScopeReads(
  component: Component,
  record: Record<string, unknown>,
  scope: RecordScope | undefined
): { readonly printable: Record<string, unknown>; readonly json: string | undefined } {
  if (scope === undefined) return { printable: record, json: undefined }
  return {
    printable: (scope.printable[RECORD_NAMESPACE] ?? record) as Record<string, unknown>,
    json: component.type === 'code' ? loneTokenJson(component.content, scope) : undefined,
  }
}

/** The sentences a copy carries on its own node, resolved as text. */
const TEXT_KEYS: ReadonlySet<string> = new Set(['title', 'description', 'label'])

/** The addresses and the alternative text a copy carries, resolved to the stored value. */
const ADDRESS_KEYS: ReadonlySet<string> = new Set(['href', 'src', 'alt'])

/** A copy's props: `data-*` and address strings resolve, every other prop is left as written. */
function propsInScope(props: Component['props'], scope: RecordScope): Component['props'] {
  if (props === undefined) return props
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      (key.startsWith('data-') || ADDRESS_KEYS.has(key)) && typeof value === 'string'
        ? substituteScopedVars(value, scope.printable)
        : value,
    ])
  )
}

/** A copy's own typed keys: its sentences as text, its addresses as the stored value. */
function typedKeysInScope(node: Component, scope: RecordScope): Partial<Component> {
  const text = withScopesText(scope.printable)
  return Object.fromEntries(
    Object.entries(node).flatMap(([key, value]) => {
      if (typeof value !== 'string') return []
      if (TEXT_KEYS.has(key)) return [[key, substituteScopedVars(value, text)]]
      if (ADDRESS_KEYS.has(key)) return [[key, substituteScopedVars(value, scope.printable)]]
      return []
    })
  ) as Partial<Component>
}

/**
 * One `description-list` pair inside a copy, resolved as the bound page resolves
 * it: `term` and `detail` are sentences and print as text; `action.href` is an
 * address and takes the stored value; a `detail` naming a `format` hands the
 * renderer the STORED value to format — the element's own value for a lone
 * token (`$step.durationMs` with `format: 'duration'`), else the detail's
 * stored-value text — so a step's duration reads as the grid cell beside it.
 */
function itemInScope(item: unknown, scope: RecordScope): unknown {
  if (!isFields(item)) return item
  const text = withScopesText(scope.printable)
  const { term, detail, format, action } = item
  const fill = (value: unknown, scopes: RecordScope['printable']): unknown =>
    typeof value === 'string' ? substituteScopedVars(value, scopes) : value
  const formatValue =
    typeof format === 'string' && typeof detail === 'string'
      ? (loneTokenValue(detail, scope) ?? substituteScopedVars(detail, scope.printable))
      : undefined
  return {
    ...item,
    term: fill(term, text),
    ...(detail !== undefined && { detail: fill(detail, text) }),
    ...(formatValue !== undefined && { _formatValue: formatValue }),
    ...(isFields(action) && { action: { ...action, href: fill(action['href'], scope.printable) } }),
  }
}

/** A copy's `description-list` pairs, resolved; nothing for any other node. */
function itemsInScope(node: Component, scope: RecordScope): Partial<Component> {
  const { items } = node as { readonly items?: unknown }
  if (node.type !== 'description-list' || !Array.isArray(items)) return {}
  return { items: items.map((item: unknown) => itemInScope(item, scope)) } as Partial<Component>
}

/** One template node, resolved against one copy's scope. */
function nodeInScope(node: Component | string, scope: RecordScope): Component | string {
  if (typeof node === 'string') return substituteScopedVars(node, withScopesText(scope.printable))
  const json = node.type === 'code' ? loneTokenJson(node.content, scope) : undefined
  const resolved = substituteScopesInContent(node.content, scope.printable)
  const own: Component = {
    ...node,
    ...typedKeysInScope(node, scope),
    ...itemsInScope(node, scope),
    props: withPlainTextPin(propsInScope(node.props, scope), resolved.forcePlainText),
    content: json ?? resolved.content,
  }
  return isRepeating(own)
    ? expandRepeat(own, scope)
    : {
        ...own,
        children: filterChildrenForElement(node.children ?? [], scope.nearest).map(
          (child: Component | string) => nodeInScope(child, scope)
        ),
      }
}

/** Does this component declare a `repeat`? */
export const isRepeating = (component: Component): boolean =>
  isFields((component as { readonly repeat?: unknown }).repeat)

/**
 * Replace a repeating container's children with one copy of them per element of
 * the array its `repeat.record` names on the nearest record, and drop the key.
 *
 * A missing field or a non-array renders ZERO children — never the template,
 * which would ship its tokens as text — so the container is empty and a
 * `:empty` rule can style the empty state.
 */
export function expandRepeat(component: Component, scope: RecordScope): Component {
  const { repeat, ...rest } = component as Component & {
    readonly repeat: { readonly record: string; readonly as?: string }
  }
  const source = isFields(scope.nearest) ? scope.nearest[repeat.record] : undefined
  const template = component.children ?? []
  const copies = Array.isArray(source)
    ? source.flatMap((element) =>
        filterChildrenForElement(template, element).map((child: Component | string) =>
          nodeInScope(child, elementScope(scope, repeat.as, element))
        )
      )
    : []
  return { ...rest, children: copies } as Component
}
