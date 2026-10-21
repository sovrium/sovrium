/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from '@/domain/kernel/config-parsing/map-strings-deep'
import {
  isRecordFieldRef,
  printableRecordFields,
  withRecordText,
} from '@/domain/models/app/pages/substitute-record-vars'
import { toInertTemplateValue } from '@/presentation/design/session-template'
import { substituteRecordVars } from '@/presentation/render/resolve/data-source-contracts'
import { editSelectRecordPatch } from './edit-select-record'
import { RECORD_DISPLAY_KEY, recordDisplayOf } from './record-display-labels'

/**
 * `$record.*` template substitution for the non-prop/content/children surfaces of
 * a collection-bound component — an action's `inputData` map and a form's
 * `fields[].defaultValue`. Kept in its own module so `data-source-resolver.ts`
 * stays under its `max-lines` cap.
 */

/**
 * Map every string value of a key→value map through a `$record.*`
 * substitution, at every depth — a value inside a nested object or a list is
 * filled as a top-level one is — leaving non-string leaves untouched.
 *
 * The substitution function stays INJECTED even though both callers reach the
 * same implementation — the page renderer re-exports
 * `domain/utils.substituteRecordVars` and the button renderer imports it
 * directly. It is injected because this loop has no business knowing which
 * substitutor its caller wants, and an inlined import would silently re-fix
 * that choice here.
 *
 * Both `substituteRecordInProps` / `substituteRecordInAction` (here) and the
 * automation-button renderer's `resolveInputDataRecordVars` share this loop.
 */
export function substituteRecordInInputData(
  inputData: Record<string, unknown>,
  record: Readonly<Record<string, unknown>>,
  substitute: (value: string, record: Readonly<Record<string, unknown>>) => string
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(inputData).map(([key, value]) => [
      key,
      mapStringsDeep(value, (text) => substitute(text, record)),
    ])
  )
}

/**
 * The constructs a record-supplied style declaration may not introduce.
 *
 * The same four `validateTailwindClassList` refuses inside an arbitrary class
 * value, for the same reason and minus `@import`, which a style declaration
 * cannot express. A style value cannot introduce a selector, but `url(` in one
 * is still a request to a third party made on the reader's behalf out of a value
 * the operator never saw.
 */
const EXTERNAL_REFERENCE = /url\(|image-set\(|attr\(|expression\(/i

/**
 * Substitute a style object's leaves, dropping any DECLARATION whose value came
 * from the record and smuggles an external reference.
 *
 * The declaration and not the element: losing a whole row to one bad value
 * leaves an operator with nothing to look at and no idea why.
 *
 * Only a value the record supplied is checked. A style the OPERATOR authored is
 * their own config and is left exactly as written — the exposure this closes is
 * a table field, which is the one row value an operator does not author.
 */
function substituteRecordInStyle(style: unknown, record: Record<string, unknown>): unknown {
  if (style === null || typeof style !== 'object' || Array.isArray(style)) {
    return mapStringsDeep(style, (value) => substituteRecordVars(value, record))
  }
  return Object.fromEntries(
    Object.entries(style as Record<string, unknown>).flatMap(([property, value]) => {
      if (typeof value !== 'string') return [[property, value] as const]
      const resolved = substituteRecordVars(value, record)
      const fromRecord = value.includes('$record.')
      if (fromRecord && EXTERNAL_REFERENCE.test(resolved)) return []
      return [[property, resolved] as const]
    })
  )
}

/**
 * An alert dialog's `confirmText` filled from the record, every filled value
 * inert like a confirm's `matchValue`: the browser resolves `$session` in this
 * text, and only a token the author wrote may be resolved. Every road that
 * fills a component from a record (a record page, a single-record binding, a
 * row template, and the same key under `props`) fills it here.
 */
const fillConfirmText = (text: string, record: Record<string, unknown>): string =>
  substituteRecordVars(text, printableRecordFields(record), toInertTemplateValue)

/**
 * Substitute `$record.*` tokens in every string LEAF of a props map.
 *
 * Deep, and it has to be. `props` is the one surface a row template has for
 * carrying a per-row VALUE — a bar drawn at its own width has nowhere else to
 * put it, since a config page has no arithmetic and no class it could compose
 * per row — and `style` is a nested object. A top-level-only pass left
 * `style: { width: '$record.value' }` in the response as literal text, which is
 * the failure mode that looks most like success: the element draws, at its
 * default size.
 *
 * `$param` was widened to every leaf for the reason its own module gives —
 * enumerating the keys a value is useful in means the pass silently stops
 * covering each new one — and `$record` was the last of the four `$`-references
 * still enumerating one.
 */
export function substituteRecordInProps(
  props: Record<string, unknown>,
  record: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      key === 'style'
        ? substituteRecordInStyle(value, record)
        : key === 'confirmText' && typeof value === 'string'
          ? fillConfirmText(value, record)
          : mapStringsDeep(value, (str) => substituteRecordVars(str, record)),
    ])
  )
}

/**
 * Substitute `$record.*` tokens inside an action's `inputData` map (used by
 * automation / fetch buttons). Returns the action unchanged when it has no
 * templated `inputData`. Non-string values pass through untouched.
 */
function substituteRecordInAction(action: unknown, record: Record<string, unknown>): unknown {
  if (action === null || typeof action !== 'object') return action
  const { inputData } = action as { inputData?: unknown }
  if (inputData === null || typeof inputData !== 'object' || Array.isArray(inputData)) return action
  const substituted = substituteRecordInInputData(
    inputData as Record<string, unknown>,
    record,
    substituteRecordVars
  )
  return { ...(action as Record<string, unknown>), inputData: substituted }
}

/**
 * Substitute `$record.*` tokens inside a form's `fields[]` (today: the
 * `defaultValue` of a hidden field that carries a parent FK). Returns `undefined`
 * when `fields` is not an array (so the caller can skip the spread).
 */
function substituteRecordInFields(fields: unknown, record: Record<string, unknown>): unknown {
  if (!Array.isArray(fields)) return undefined
  return fields.map((field) => {
    if (field === null || typeof field !== 'object') return field
    const { defaultValue } = field as { defaultValue?: unknown }
    if (typeof defaultValue !== 'string') return field
    return {
      ...(field as Record<string, unknown>),
      defaultValue: substituteRecordVars(defaultValue, record),
    }
  })
}

/**
 * Substitute `$record.*` in a `confirm` gate: the string prompt, or every string
 * of the object form, its labels included. Filled from the record the
 * page was handed, which is already projected for its reader, so a field she
 * may not read fills with nothing and never reaches the served HTML. An escaped
 * `\$record.x` prints as the token; a `$session.*` token is left for the client
 * gate, which resolves it from the caller's own session. The title and message
 * are prose and print a value formatted; the phrase keeps the stored value, so
 * it is typable from what is stored. A record VALUE filled
 * into `matchValue` is made inert (`toInertTemplateValue`), so the browser asks
 * for it exactly as written: its `$session.` text is not resolved for the
 * reader, its brackets stay, and a trailing `\` escapes no author token. A field holding an
 * object prints its own token, as it does in page text, never `[object Object]`.
 * `undefined` when the component declares no confirm.
 */
function substituteRecordInConfirm(confirm: unknown, raw: Record<string, unknown>): unknown {
  const record = printableRecordFields(raw)
  const prose = withRecordText(record)
  if (typeof confirm === 'string') return substituteRecordVars(confirm, prose)
  if (confirm === null || typeof confirm !== 'object') return undefined
  const fill = (value: unknown): unknown =>
    typeof value === 'string' ? substituteRecordVars(value, prose) : value
  const { title, message, input } = confirm as Record<string, unknown>
  const matchValue =
    input !== null && typeof input === 'object'
      ? (input as Record<string, unknown>)['matchValue']
      : undefined
  // Every other leaf (`confirmLabel`, `cancelLabel`, `input.label`) keeps the
  // stored value — the label naming the phrase must print what is typed.
  const stored = mapStringsDeep(confirm, (value) => substituteRecordVars(value, record)) as Record<
    string,
    unknown
  >
  return {
    ...stored,
    ...(title !== undefined && { title: fill(title) }),
    ...(message !== undefined && { message: fill(message) }),
    ...(matchValue !== undefined && {
      input: {
        ...(stored['input'] as Record<string, unknown>),
        matchValue:
          typeof matchValue === 'string'
            ? substituteRecordVars(matchValue, record, toInertTemplateValue)
            : matchValue,
      },
    }),
  }
}

/**
 * Build the spreadable `{ action?, fields?, confirmText? }` patch for a
 * collection-template component — substituting `$record.*` in an action's
 * `inputData`, a form's `fields[].defaultValue`, an alert dialog's
 * `confirmText` (the name a reader types to confirm a delete), a button's `confirm` gate, a derived
 * breadcrumb's `currentLabel` (the record's own name ending the trail) and an
 * enumerated trail's `breadcrumbItems` labels. Keys are present
 * only when there is something to spread, so the caller can `...patch` without
 * clobbering absent fields.
 */
export function buildRecordTemplatePatch(
  component: {
    readonly action?: unknown
    readonly fields?: unknown
    readonly confirmText?: unknown
    readonly confirm?: unknown
    readonly currentLabel?: unknown
    readonly breadcrumbItems?: unknown
    readonly type?: string
    readonly items?: unknown
  },
  record: Record<string, unknown>,
  tableName?: string
): {
  action?: unknown
  fields?: unknown
  confirmText?: string
  confirm?: unknown
  currentLabel?: string
  breadcrumbItems?: unknown
  items?: unknown
  /** A button picker's filled action and its record's value (`edit-select-record.ts`). */
  readonly [key: string]: unknown
} {
  const items = withDescriptionFieldValues(component, record, tableName)
  const action = substituteRecordInAction(component.action, record)
  const fields = substituteRecordInFields(component.fields, record)
  const confirm = substituteRecordInConfirm(component.confirm, record)
  const { confirmText, currentLabel } = component
  const breadcrumbItems = substituteRecordInCrumbs(component.breadcrumbItems, record)
  return {
    ...(action !== undefined && { action }),
    ...(fields !== undefined && { fields }),
    ...(confirm !== undefined && { confirm }),
    ...(typeof confirmText === 'string' && { confirmText: fillConfirmText(confirmText, record) }),
    ...(typeof currentLabel === 'string' && {
      currentLabel: substituteRecordVars(currentLabel, withCrumbText(record)),
    }),
    ...(breadcrumbItems !== undefined && { breadcrumbItems }),
    ...(items !== undefined && { items }),
    ...editSelectRecordPatch(component, record),
  }
}

/**
 * A record projected for a breadcrumb's words: {@link withRecordText}, and
 * every field the record carries a display label for — a relationship's linked
 * record by its display field, a `user` field's person by name — prints that
 * label, as the description list beside it does; `<field>.raw` keeps the
 * stored value.
 */
function withCrumbText(
  record: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const prose = withRecordText(record)
  const block = record[RECORD_DISPLAY_KEY]
  if (block === null || typeof block !== 'object') return prose
  const labelled = Object.keys(block).flatMap((field) => {
    const label = recordDisplayOf(record, field)
    return label === undefined ? [] : [[field, label] as const]
  })
  return {
    ...prose,
    ...Object.fromEntries(labelled.map(([field]) => [`${field}.raw`, record[field]])),
    ...Object.fromEntries(labelled),
  }
}

/**
 * An enumerated breadcrumb's crumbs filled from the record: each `label` is
 * prose and prints a value formatted — a linked record by its display field —
 * as a derived trail's `currentLabel` does; an `href` keeps the stored value.
 * `undefined` when there are no crumbs.
 */
function substituteRecordInCrumbs(crumbs: unknown, record: Record<string, unknown>): unknown {
  if (!Array.isArray(crumbs)) return undefined
  const prose = withCrumbText(record)
  return crumbs.map((crumb: unknown) => {
    if (crumb === null || typeof crumb !== 'object') return crumb
    const { label } = crumb as { readonly label?: unknown }
    return {
      ...(mapStringsDeep(crumb, (value) => substituteRecordVars(value, record)) as object),
      ...(typeof label === 'string' && { label: substituteRecordVars(label, prose) }),
    }
  })
}

/** The printed text a page record carries for `field`, when it carries one. */
const textOf = (prose: Readonly<Record<string, unknown>>, field: string): string | undefined => {
  const value = prose[field]
  return typeof value === 'string' && prose[`${field}.raw`] !== undefined ? value : undefined
}

/**
 * What a text entry that names a `format` hands the renderer: the STORED value
 * to format, never the prose its detail would print — formatting a date already
 * written out for reading would format text. A detail that is one
 * `$record.<field>` reference carries that field's value and name, so the
 * renderer reads its zone and currency as the grid column does; any other
 * detail carries its stored-value text.
 */
function formatSourceOf(
  detail: unknown,
  format: unknown,
  record: Record<string, unknown>,
  tableName: string | undefined
): Readonly<Record<string, unknown>> {
  if (typeof format !== 'string' || typeof detail !== 'string') return {}
  const table = tableName === undefined ? {} : { _recordTable: tableName }
  if (!isRecordFieldRef(detail)) {
    return { _formatValue: substituteRecordVars(detail, record), ...table }
  }
  const fieldName = detail.slice('$record.'.length)
  return { _formatValue: record[fieldName] ?? null, _formatField: fieldName, ...table }
}

/**
 * A `description-list`'s entries filled from the bound record. An entry naming a
 * `field` carries the record's value and table on to the renderer, which draws
 * it BY ITS TYPE — the hand-off a `record-field` gets from
 * `injectRecordFieldValue`. A text entry's `detail` is prose and prints a value
 * formatted, unless it names a `format`, which reads the stored value
 * ({@link formatSourceOf}); every other string keeps the stored value.
 */
export function withDescriptionFieldValues(
  component: { readonly type?: string; readonly items?: unknown },
  record: Record<string, unknown>,
  tableName: string | undefined
): readonly unknown[] | undefined {
  if (component.type !== 'description-list' || !Array.isArray(component.items)) return undefined
  const prose = withRecordText(record)
  return component.items.map((item: unknown) => {
    if (item === null || typeof item !== 'object') return item
    const { field, detail, format } = item as {
      readonly field?: unknown
      readonly detail?: unknown
      readonly format?: unknown
    }
    return {
      ...(mapStringsDeep(item, (value) => substituteRecordVars(value, record)) as object),
      ...(typeof detail === 'string' && { detail: substituteRecordVars(detail, prose) }),
      ...formatSourceOf(detail, format, record, tableName),
      ...(typeof field === 'string' && {
        _recordValue: record[field] ?? null,
        // A system record has no table to type its fields by: what it reads as
        // (its date-time, its list) is the text the page record carries.
        _recordDisplay:
          recordDisplayOf(record, field) ??
          (tableName === undefined ? textOf(prose, field) : undefined),
        ...(tableName !== undefined ? { _recordTable: tableName } : {}),
      }),
    }
  })
}

/**
 * A component's PROSE typed field filled from the record: a confirm's title and
 * message and a breadcrumb's `currentLabel` print a value formatted, as page
 * text does. `undefined` for every other key, which keeps the stored value.
 */
export function fillProseField(
  key: string,
  value: unknown,
  record: Record<string, unknown>
): unknown {
  if (key === 'confirm') return substituteRecordInConfirm(value, record)
  if (key === 'confirmText' && typeof value === 'string') return fillConfirmText(value, record)
  if (key === 'currentLabel' && typeof value === 'string') {
    return substituteRecordVars(value, withCrumbText(record))
  }
  return undefined
}
