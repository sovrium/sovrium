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
 * escaping is why they are one module: whether a value is HTML-escaped depends
 * on whether the AUTHOR's template was HTML, a single decision that has to be
 * made identically at every destination or the same record renders differently
 * in two places on one page.
 *
 * The collection-page variant and the per-row expansion live in
 * `data-source-rows.ts`, which calls into this module once per row.
 */

import { mapStringsDeep } from '@/domain/models/app/languages/translation-resolver'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { substituteRecordInProps } from './record-template-substitution'
import { filterChildrenForRecord } from './record-visibility'
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
 *
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
 * forgeable (`&lt;` in the data would otherwise decode to a real `<`).
 */
const escapeRecordValueForHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * Substitutes `$record.*` into a component's `content` WITHOUT letting record
 * data decide whether the result is rendered as HTML or as text.
 *
 * WHY THIS EXISTS. `renderHTMLElement`
 * (ui/sections/renderers/element-renderers/html-element-renderer.tsx) renders
 * `content` through `dangerouslySetInnerHTML` when it starts with `<`. That
 * test used to run on the POST-substitution string — so the config author wrote
 * the literal `'$record.bio'`, which plainly is not HTML, and the RECORD then
 * decided at request time which branch that config took. A stored value
 * beginning with `<` flipped the element out of React's escaped-children path
 * into the raw-HTML path: stored XSS against every later visitor, plantable
 * through whatever ordinary write path the app exposes, no authentication
 * required. The renderer's own docstring asserted the opposite ("content is
 * from server configuration, not user input"), which is precisely why the
 * branch read as safe to every previous reader.
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
 * THE EXPOSURE WAS NEVER UNIFORM, and nothing in the schema signalled it:
 * `text` ends in `renderParagraph`/`renderHeading` (React children — always
 * escaped, always safe), while `container`, `flex`, `grid`, `card`,
 * `accordion`, `modal`, `sidebar`, `toast`, `list-item` and the unknown-type
 * fallback all route through the sniffing sink. This function runs for every
 * content site regardless, so the posture no longer depends on which component
 * type an author happened to wrap the value in.
 */
export function substituteRecordInContent(
  content: Component['content'],
  record: Record<string, unknown>
): { readonly content: Component['content']; readonly forcePlainText: boolean } {
  if (typeof content !== 'string') return { content, forcePlainText: false }
  if (templateIsAuthorHtml(content)) {
    return {
      content: substituteRecordVars(content, record, escapeRecordValueForHtml),
      forcePlainText: false,
    }
  }
  const substituted = substituteRecordVars(content, record)
  // Only flag the case that would actually flip the sink — an author TEXT
  // template whose substituted result now begins with `<`.
  return { content: substituted, forcePlainText: templateIsAuthorHtml(substituted) }
}

/** Adds the plain-text pin to a component's props when the sink would flip. */
export const withPlainTextPin = (
  props: Component['props'],
  forcePlainText: boolean
): Component['props'] =>
  forcePlainText ? { ...(props ?? {}), [CONTENT_PLAIN_TEXT_ATTR]: true } : props

/**
 * Substitutes `$record.<field>` tokens inside `dataSource.filter[].value`
 * strings using the parent collection record ([internal ref] —
 * Category & Tag Patterns).
 *
 * The collection-page resolver runs BEFORE component-level dataSource
 * resolution, so a category page's `$record.name` token is the parent
 * category's name. By substituting it here, a nested
 * `dataSource.filter[].value: '$record.name'` becomes a concrete literal
 * (eg. `'Technology'`) before `resolvePageDataSources` builds the SQL
 * query — enabling cross-table filtering driven by the parent record.
 *
 * Only string filter values are substituted. Numeric, boolean, array, and
 * `$currentUser` reference values pass through unchanged so the existing
 * filter pipeline (literal types + `$currentUser` resolver) keeps working.
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
const substituteRecordInSystemBinding = (
  system: Record<string, unknown>,
  record: Record<string, unknown>
): Record<string, unknown> =>
  mapStringsDeep(system, (value) => substituteRecordVars(value, record)) as Record<string, unknown>

export function substituteRecordInDataSource(
  dataSource: NonNullable<Component['dataSource']>,
  record: Record<string, unknown>
): NonNullable<Component['dataSource']> {
  const { system } = dataSource as { readonly system?: unknown }
  const withSystem =
    system !== null && typeof system === 'object' && !Array.isArray(system)
      ? {
          ...dataSource,
          system: substituteRecordInSystemBinding(system as Record<string, unknown>, record),
        }
      : dataSource
  const { filter } = withSystem
  if (!filter || filter.length === 0) return withSystem
  return {
    ...withSystem,
    filter: filter.map((f: DataFilter): DataFilter =>
      typeof f.value === 'string' ? { ...f, value: substituteRecordVars(f.value, record) } : f
    ),
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
 * record ([internal ref] — Category & Tag Patterns).
 */
export function substituteRecordInComponent(
  component: Component,
  record: Record<string, unknown>,
  tableName?: string,
  substitution: RowSubstitutionDepth = 'deep'
): Component {
  // GAP-5: a read-only `record-field` display component resolves the bound
  // record's value for `props.field` by the field's declared type. Inject the
  // raw value + bound table name as render-time props so the renderer can
  // dispatch (rich-text → sanitized HTML, attachment → download link, else text)
  // without threading the whole record down through the dispatch config.
  if (component.type === 'record-field') {
    return injectRecordFieldValue(component, record, tableName)
  }
  const resolvedContent = substituteRecordInContent(component.content, record)
  return {
    ...component,
    // Every OTHER string leaf — a component's own TYPED fields.
    //
    // ─── WHY EVERY LEAF, AND NOT A LIST OF KEYS ─────────────────────────────
    //
    // The four keys handled explicitly below are the ones with SEMANTICS:
    // `content` decides HTML-vs-text escaping from the author's own template,
    // `props` carries the plain-text pin, `dataSource` rewrites filters, and
    // `children` is where `visibility.record` is evaluated. Everything else had
    // no substitution at all — a `specimen.subject.type`, a `swatch.token`
    // and a `badge.foreground` each reached the browser as the literal
    // text `$record.…`, which is the failure mode that looks most like success.
    //
    // Enumerating the keys a row value is useful in means the pass silently
    // stops covering each new one. `$param` was widened to every string LEAF for
    // exactly that reason (`route-param-props-resolver.ts`), and this reuses its
    // walker rather than growing a second one that could disagree with it.
    ...substituteRecordInTypedFields(component, record),
    props: withPlainTextPin(
      component.props ? substituteRecordInProps(component.props, record) : component.props,
      resolvedContent.forcePlainText
    ),
    content: resolvedContent.content,
    dataSource: component.dataSource
      ? substituteRecordInDataSource(component.dataSource, record)
      : component.dataSource,
    // A STRING CHILD needs no escaping and must not get any. Children are
    // rendered by `renderChildren` (ui/sections/component-renderer.tsx) as React
    // children, which escape on output and never reach a
    // `dangerouslySetInnerHTML` sink — only `content` is sniffed. Escaping here
    // too would double-escape: `<` would become `&lt;`, which React then emits
    // as `&amp;lt;`, so the visitor sees the literal characters `&lt;`.
    // `visibility.record` is evaluated HERE, one level at a time, so the gate
    // reaches any depth of a row template rather than only its outermost
    // children. A failing child is DROPPED — omitted from the HTML, never
    // hidden — see `record-visibility.ts`.
    // An INNER `{ system }` binding's children are left alone: they are a
    // template that has not met its own rows yet, and consuming their
    // `$record.` against THIS row would resolve every one of them against a
    // record that has no such field — blanking the inner rows before the inner
    // read ever runs. Everything else about this node is still substituted,
    // including its own `dataSource`, which is what makes the inner read a
    // DIFFERENT read per outer row.
    //
    // Only the children are withheld, and only under `stop-at-nested-binding`:
    // the typed-field walk above still runs, which is the half a switch to
    // `substituteRecordInCollectionTemplate` silently lost — that helper
    // predates the typed-field widening, so a `swatch.token` or a
    // `specimen.subject.type` stopped resolving the moment the system path went
    // through it.
    children:
      substitution === 'stop-at-nested-binding' && component.dataSource !== undefined
        ? (component.children ?? [])
        : filterChildrenForRecord(component.children ?? [], record).map(
            (child: Component | string) =>
              typeof child === 'string'
                ? substituteRecordVars(child, record)
                : substituteRecordInComponent(child, record, tableName, substitution)
          ),
  }
}

/**
 * The keys {@link substituteRecordInComponent} handles itself, and which the
 * generic leaf walk must therefore leave alone.
 *
 * Each has semantics a blind string replace would destroy — escaping decided
 * from the author's own template, the plain-text pin, filter rewriting, and the
 * per-child `visibility.record` gate.
 */
const RECORD_SUBSTITUTION_OWN_KEYS = ['props', 'content', 'dataSource', 'children'] as const

/**
 * Substitute `$record.*` into a component's own TYPED fields — every string
 * leaf outside the four keys handled explicitly.
 *
 * Returns a PARTIAL: only the keys that actually carried a reference, so a
 * component with none is spread with nothing and stays referentially identical
 * in every field.
 */
function substituteRecordInTypedFields(
  component: Component,
  record: Record<string, unknown>
): Partial<Component> {
  const substitute = (value: string): string =>
    value.includes('$record.') ? substituteRecordVars(value, record) : value

  return Object.fromEntries(
    Object.entries(component)
      .filter(([key]) => !(RECORD_SUBSTITUTION_OWN_KEYS as readonly string[]).includes(key))
      .map(([key, value]) => [key, mapStringsDeep(value, substitute)])
  ) as Partial<Component>
}

/**
 * Injects the bound record's raw value + table name into a `record-field`
 * component's props (`_recordValue`, `_recordTable`). The renderer reads these
 * plus `config.tables` to look up the field's declared type and render it
 * read-only (GAP-5 / [internal ref]).
 */
export function injectRecordFieldValue(
  component: Component,
  record: Record<string, unknown>,
  tableName: string | undefined
): Component {
  const baseProps = component.props ? substituteRecordInProps(component.props, record) : {}
  const fieldName = baseProps['field']
  const value = typeof fieldName === 'string' ? record[fieldName] : undefined
  return {
    ...component,
    props: {
      ...baseProps,
      _recordValue: value,
      ...(tableName !== undefined ? { _recordTable: tableName } : {}),
    },
  }
}
