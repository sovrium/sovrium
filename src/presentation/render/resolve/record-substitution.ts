/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `$record.<field>` substitution: turning ONE record into the component tree an
 * author's template described.
 *
 * `substituteRecordInComponent` is the entry point; everything else here is a
 * destination it substitutes INTO — content, props, typed fields, a nested data
 * source, a system binding — and the escaping rule each destination needs. The
 * escaping is why they are one module: a value is HTML-escaped when the AUTHOR's
 * template was HTML, one decision every destination has to take identically.
 *
 * The per-row expansion lives in `data-source-rows.ts`, which calls in per row.
 */

import { mapStringsDeep } from '@/domain/kernel/config-parsing/map-strings-deep'
import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'
import { substituteRecordInFilter } from '@/domain/models/app/pages/record-filter-substitution-service'
import {
  substituteRecordVars,
  substituteScopedVars,
  withRecordText,
  withScopesText,
} from '@/domain/models/app/pages/substitute-record-vars'
import {
  componentField,
  entryAsComponent,
  rewriteComponent,
  type ComponentBinding,
  type ComponentContent as Content,
  type RenderProps,
} from './component-rewrite'
import { walkComponentSlots, type ComponentListEntry } from './component-slot-walk'
import { drawsOwnRows } from './nested-row-lists'
import { fillAuthorTag } from './record-address-attributes'
import { withControlRecord } from './record-control-binding'
import { recordDisplayOf } from './record-display-labels'
import { substituteRecordInProps, withDescriptionFieldValues } from './record-template-substitution'
import { substituteRecordInTypedFields } from './record-typed-fields'
import { filterChildrenForRecord, labelsFollowingRecord } from './record-visibility'
import type { RowSubstitutionDepth } from './data-source-rows'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'

/**
 * Private resolver→renderer signal: "the AUTHOR wrote a TEXT template here, so
 * whatever the record put into it must render as text."
 *
 * Spelled as a `data-*` attribute deliberately. Element props are spread onto
 * the DOM node by every renderer, and `convertCustomPropsToDataAttributes`
 * (ui/sections/props/prop-conversion.ts) rewrites any non-`data-` custom prop
 * into one anyway — so a `data-` name is the only spelling that neither trips a
 * React unknown-attribute warning nor gets silently renamed in transit.
 * `renderHTMLElement` strips it before it reaches the element. Renderers that
 * pass content through React children are already safe and simply ignore it.
 * Mirrors the existing `_dataSourceError` resolver→renderer channel.
 */
const CONTENT_PLAIN_TEXT_ATTR = 'data-content-plain-text'

/** Does this template's OWN first character make it HTML, before any record data? */
const templateIsAuthorHtml = (template: string): boolean => template.trim().startsWith('<')

/**
 * HTML-escape a record value that is being interpolated into an author's HTML
 * template — a destination where entities genuinely DO decode.
 *
 * The full five-character escape, not just the tag delimiters, because an
 * author HTML template may interpolate into either a text or an ATTRIBUTE
 * context and the resolver cannot tell which:
 *
 *     content: '<p>$record.bio</p>'          → text context
 *     content: '<img alt="$record.bio">'     → attribute context
 *
 * Escaping only `<` and `>` closes the first and leaves the second wide open: a
 * stored value of `" onerror="alert(1)` walks straight out of the `alt`
 * attribute and adds an event handler to the author's own tag. Quotes are what
 * shut that door, and `&` must be escaped first or the escaping is itself
 * forgeable (`&lt;` in the data would otherwise decode to a real `<`). The
 * kernel's `escapeHtmlAttribute` is exactly that escape, so it is used rather than copied.
 */
const escapeRecordValueForHtml = escapeHtmlAttribute

/**
 * Substitutes `$record.*` into a component's `content` WITHOUT letting record
 * data decide whether the result is rendered as HTML or as text.
 *
 * WHY THIS EXISTS. `renderHTMLElement`
 * (ui/sections/renderers/element-renderers/html-element-renderer.tsx) renders
 * `content` through `dangerouslySetInnerHTML` when it starts with `<`. Run on
 * the POST-substitution string, that test would let the RECORD decide at
 * request time which branch the config takes: the config author writes the
 * literal `'$record.bio'`, which plainly is not HTML, yet a stored value
 * beginning with `<` would flip the element out of React's escaped-children
 * path into the raw-HTML path — stored XSS against every later visitor,
 * plantable through whatever ordinary write path the app exposes, no
 * authentication required. "Content is from server configuration, not user
 * input" is false here, which is why the branch can read as safe when it is
 * not.
 *
 * THE DECISION IS TAKEN FROM THE AUTHOR'S TEMPLATE ALONE. Two cases:
 *
 *  - Author wrote HTML (`'<p>$record.bio</p>'`) — the markup is theirs and
 *    stays byte-identical, but each substituted VALUE is HTML-escaped, so
 *    record data contributes text and never markup. Entities decode at this
 *    destination, so `Smith & Sons` renders as `Smith & Sons`.
 *  - Author wrote TEXT (`'$record.bio'`, `'Bio: $record.bio'`) — the value is
 *    substituted VERBATIM and {@link CONTENT_PLAIN_TEXT_ATTR} pins the text
 *    branch. React escapes it on output, so the payload survives as readable
 *    text. Escaping here instead would be wrong twice over: React children do
 *    NOT decode entities, so `&lt;` would render as the visible characters
 *    `&lt;` rather than as `<`, corrupting every legitimate `a < b` and
 *    `Q4 > Q3` in every bound record — and double-escaping is a display defect
 *    wearing a security fix's clothes.
 *
 * The exposure was never uniform (`text` renders React children; `container`,
 * `card`, `list-item` and others route through the sniffing sink), so this runs
 * for every content site regardless of the component type.
 *
 * Content is a TEXT site: a value its record formats (a date, an amount) prints
 * formatted, except inside an author tag, where it keeps the stored value.
 */
export function substituteRecordInContent(
  content: Content,
  record: Record<string, unknown>
): { readonly content: Content; readonly forcePlainText: boolean } {
  return substituteScopesInContent(content, { record })
}

/**
 * {@link substituteRecordInContent} over several namespaces at once — the one
 * HTML-or-text decision, taken for a `repeat` copy that reads `$record.` and a
 * named element (`$leg.`) in the same string (`record-repeat-expansion.ts`).
 * One pass per string, so a substituted value is never scanned again.
 */
export function substituteScopesInContent(
  content: Content,
  scopes: Readonly<Record<string, Readonly<Record<string, unknown>>>>
): { readonly content: Content; readonly forcePlainText: boolean } {
  if (typeof content !== 'string') return { content, forcePlainText: false }
  const text = withScopesText(scopes)
  if (templateIsAuthorHtml(content)) {
    // A tag keeps the stored value (an attribute is an address or a value);
    // only the text between tags is prose.
    // An address the record would open is held to a web address or a site path.
    const fill = (part: string) =>
      part.startsWith('<')
        ? fillAuthorTag(part, scopes, escapeRecordValueForHtml)
        : substituteScopedVars(part, text, escapeRecordValueForHtml)
    return {
      content: content
        .split(/(<[^>]*>)/)
        .map(fill)
        .join(''),
      forcePlainText: false,
    }
  }
  const substituted = substituteScopedVars(content, text)
  // Only flag the case that would actually flip the sink — an author TEXT
  // template whose substituted result now begins with `<`.
  return { content: substituted, forcePlainText: templateIsAuthorHtml(substituted) }
}

/** Adds the plain-text pin to a component's props when the sink would flip. */
export const withPlainTextPin = (
  props: RenderProps | undefined,
  forcePlainText: boolean
): RenderProps | undefined =>
  forcePlainText ? { ...(props ?? {}), [CONTENT_PLAIN_TEXT_ATTR]: true } : props

/** Has an earlier pass already pinned this component's content to the text branch? */
export const hasPlainTextPin = (props: unknown): boolean =>
  props !== null &&
  typeof props === 'object' &&
  (props as Readonly<Record<string, unknown>>)[CONTENT_PLAIN_TEXT_ATTR] === true

/**
 * Substitutes `$record.<field>` tokens inside `dataSource.filter[].value`
 * strings using the parent collection record (the pages access publishing requirement —
 * Category & Tag Patterns).
 *
 * The collection-page resolver runs BEFORE component-level dataSource
 * resolution, so a category page's `$record.name` token is the parent
 * category's name. By substituting it here, a nested
 * `dataSource.filter[].value: '$record.name'` becomes a concrete literal
 * (eg. `'Technology'`) before `resolvePageDataSources` builds the SQL
 * query — enabling cross-table filtering driven by the parent record.
 *
 * A string value is substituted, and so is each string of a list (`in` with
 * `['$record.id']`); numbers, booleans and `$currentUser` references reach the
 * filter pipeline (literal types + `$currentUser` resolver) as they came.
 */
/**
 * A `{ system }` binding's own string leaves — the endpoint and its query.
 *
 * This is what makes a NESTED row template a different read per outer row
 * rather than the same read N times: the inner card asks
 * `/usage?name=$record.name` and the outer row supplies the name. Without it
 * the inner binding fetches the literal `$record.name`, the endpoint answers
 * nothing, and the card renders empty with no error anywhere — which is exactly
 * how this was found.
 *
 * Additive by construction: a `system` binding written before nesting existed
 * carries no `$record.` at all, so the walk is a no-op on every shipped page.
 */
const substituteRecordInSystemBinding = <T extends object>(
  system: T,
  record: Record<string, unknown>
): T => mapStringsDeep(system, (value) => substituteRecordVars(value, record)) as T

export function substituteRecordInDataSource(
  binding: ComponentBinding,
  record: Record<string, unknown>
): ComponentBinding {
  const system = typeof binding === 'object' && 'system' in binding ? binding.system : undefined
  const bound: ComponentBinding =
    system !== null && typeof system === 'object' && !Array.isArray(system)
      ? { ...binding, system: substituteRecordInSystemBinding(system, record) }
      : binding
  const filter = typeof bound === 'object' && 'filter' in bound ? bound.filter : undefined
  if (!filter || filter.length === 0) return bound
  return {
    ...bound,
    filter: filter.map((f: DataFilter): DataFilter => substituteRecordInFilter(f, record)),
  }
}

/**
 * Recursively substitutes $record.* variables in a component's props,
 * content, dataSource filters, AND children.
 *
 * Used by:
 *  - `applySingleRecordToComponent` (single-mode dataSource): the fetched
 *    record drives substitution at every level — children must be
 *    substituted because they consume the bound record's fields directly.
 *  - `expandDataSourceChildren` (list-mode dataSource): each per-row
 *    record substitutes the child template — same rationale.
 *
 * The collection-page resolver uses a different helper
 * (`substituteRecordInCollectionTemplate`) that intentionally skips the
 * children of components that themselves have a `dataSource`, because
 * those children are per-row templates that must be expanded against
 * each fetched record — not pre-substituted with the parent collection
 * record (the pages access publishing requirement — Category & Tag Patterns).
 */
export function substituteRecordInComponent(
  component: Component,
  record: Record<string, unknown>,
  tableName?: string,
  substitution: RowSubstitutionDepth = 'deep'
): Component {
  // [internal ref]: a read-only `record-field` display component resolves the bound
  // record's value for `props.field` by the field's declared type. Inject the
  // raw value + bound table name as render-time props so the renderer can
  // dispatch (rich-text → sanitized HTML, attachment → download link, else text)
  // without threading the whole record down through the dispatch config.
  if (RECORD_VALUE_TYPES.has(component.type)) {
    return injectRecordFieldValue(component, record, tableName)
  }
  const dataSource = componentField(component, 'dataSource')
  const resolvedContent = substituteRecordInContent(componentField(component, 'content'), record)
  const describedItems = withDescriptionFieldValues(component, record, tableName)
  const withheld = withholdsChildLists(component, substitution)
  const walk = (entries: readonly ComponentListEntry[]): readonly ComponentListEntry[] =>
    withheld
      ? entries
      : filterChildrenForRecord(entries, record).map((child) =>
          typeof child === 'string'
            ? substituteRecordVars(child, withRecordText(record))
            : substituteRecordInComponent(entryAsComponent(child), record, tableName, substitution)
        )
  // Every OTHER string leaf — a component's own TYPED fields — every leaf, not
  // a list of keys that would silently stop covering each new one. The four
  // keys below carry semantics; this reuses `$param`'s walker.
  const typedFields = substituteRecordInTypedFields(component, record)
  const children = component.children ?? []
  return rewriteComponent(component, {
    ...typedFields,
    props: withControlRecord(
      component,
      withPlainTextPin(
        component.props ? substituteRecordInProps(component.props, record) : component.props,
        resolvedContent.forcePlainText
      ),
      record
    ),
    content: resolvedContent.content,
    ...(describedItems !== undefined && { items: describedItems }),
    dataSource: dataSource ? substituteRecordInDataSource(dataSource, record) : dataSource,
    // A STRING CHILD needs no escaping and must not get any: children render as
    // React children, which escape on output and never reach a
    // `dangerouslySetInnerHTML` sink. Escaping here too would double-escape, so
    // the visitor would see the literal characters `&lt;`.
    // `visibility.record` is evaluated HERE, one level at a time, so the gate
    // reaches any depth of a row template. A failing child is DROPPED, omitted
    // from the HTML and never hidden: see `record-visibility.ts`.
    // An INNER `{ system }` binding's children are left alone: they are a
    // template that has not met its own rows yet, and consuming their
    // `$record.` against THIS row would resolve every one of them against a
    // record that has no such field — blanking the inner rows before the inner
    // read ever runs. Everything else about this node is still substituted,
    // including its own `dataSource`, which is what makes the inner read a
    // DIFFERENT read per outer row.
    // Only the children and slots are withheld; a slot is walked as `children` is.
    ...walkComponentSlots(component, walk),
    children: walk(children),
    ...(withheld ? {} : labelsFollowingRecord({ ...component, ...typedFields }, children, record)),
  })
}

/** `stop-at-nested-rows` keeps only a nested row list's template (`nested-row-lists.ts`). */
const withholdsChildLists = (component: Component, depth: RowSubstitutionDepth): boolean =>
  (depth === 'stop-at-nested-binding' && componentField(component, 'dataSource') !== undefined) ||
  (depth === 'stop-at-nested-rows' && drawsOwnRows(component))

/**
 * The components a bound record hands its raw value to, rather than a
 * substituted template: the read-only `record-field` and the field-bound
 * controls that draw (or write) one field of the record by its type.
 */
export const RECORD_VALUE_TYPES: ReadonlySet<string> = new Set([
  'record-field',
  'rating',
  'signature-pad',
  'file-preview',
])

/** The record's system timestamps, by the name the records API gives them. */
const SYSTEM_TIMESTAMP_COLUMNS: Readonly<Record<string, string>> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

/**
 * A field's value on the bound record. `createdAt` and `updatedAt` (the API's
 * names) read the stored column when the row carries only that.
 */
const recordValueOf = (record: Record<string, unknown>, fieldName: string): unknown => {
  const column = SYSTEM_TIMESTAMP_COLUMNS[fieldName]
  return record[fieldName] ?? (column === undefined ? undefined : record[column])
}

/**
 * Injects the bound record's raw value, its label (a person or linked record by
 * name) and table into a `record-field`'s props (`_recordValue`, `_recordDisplay`,
 * `_recordTable`). The renderer reads these plus `config.tables` to draw the
 * field read-only by its declared type.
 */
export function injectRecordFieldValue(
  component: Component,
  record: Record<string, unknown>,
  tableName: string | undefined
): Component {
  const baseProps = component.props ? substituteRecordInProps(component.props, record) : {}
  // `record-field` names its field in `props`; the field-bound controls
  // (`rating`, `signature-pad`, `file-preview`) name it on their root.
  const fieldName = baseProps['field'] ?? componentField(component, 'field')
  const value = typeof fieldName === 'string' ? recordValueOf(record, fieldName) : undefined
  const altField = componentField(component, 'altField')
  return rewriteComponent(component, {
    // A control's own sentence (`signature-pad.statement`) reads the record too.
    ...(component.type === 'record-field' ? {} : substituteRecordInTypedFields(component, record)),
    props: {
      ...baseProps,
      _recordValue: value,
      _recordDisplay: recordDisplayOf(record, fieldName),
      _recordId: record['id'],
      // A `file-preview` reads its image's alternative text from a second field.
      ...(typeof altField === 'string' && { _recordAlt: record[altField] }),
      ...(tableName !== undefined ? { _recordTable: tableName } : {}),
    },
  })
}
