/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `description-list` — term and detail pairs, as a real `<dl>`.
 *
 * ─── THE ELEMENT IS HALF THE FEATURE ───────────────────────────────────────
 *
 * A two-column `grid` of `text` components looks identical to this and
 * announces six unrelated strings; a `<dl>` of `<dt>`/`<dd>` pairs announces
 * each term WITH its detail. That is not decoration a stylesheet could have
 * supplied, and it is why `layout` changes the reading direction without
 * changing the markup: the accessible pairing has to survive the switch.
 *
 * ─── AND A ROW IS A `<div>`, WHICH `<dl>` PERMITS ──────────────────────────
 *
 * The rows carry their own grid, so a pair and its action are one placement
 * unit. Without the wrapper, grid auto-placement pulls the NEXT row's term into
 * the action column of any row that declared no action — every row after the
 * first shifted by one cell, and nothing red anywhere.
 *
 * ─── AN EMPTY DETAIL KEEPS ITS ROW ─────────────────────────────────────────
 *
 * A collapsed row tells the reader the fact was never declared, when in truth
 * it is declared and empty — the exact distinction a summary panel over a
 * record binding exists to preserve. So the `<dd>` keeps a box of its own and
 * prints a placeholder in it.
 *
 * Source: src/domain/models/app/pages/components/component-types/display/description-list.ts
 * Specs: [internal ref]
 */

import { relativeStampOf } from '@/domain/models/app/tables/relative-stamp-service'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import {
  computeDescriptionActionClasses,
  computeDescriptionDetailClasses,
  computeDescriptionEmptyClasses,
  computeDescriptionListClasses,
  computeDescriptionListRootClasses,
  computeDescriptionRowClasses,
  computeDescriptionTermClasses,
  type DescriptionListLayout,
} from '../../design/display-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { formatRecordValue } from '../props/record-value-format'
import { renderFieldDetail } from './description-list-field-detail'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { Tables } from '@/domain/models/app/tables'
import type { ReactElement, ReactNode } from 'react'

/**
 * One term-and-detail pair, as the schema declares it: a text `detail`, or a
 * `field` of the bound record whose value the binding pass stamped on it.
 */
interface DescriptionItem {
  readonly term: string
  readonly detail?: string
  readonly field?: string
  readonly _recordValue?: unknown
  /** A person or a linked record by name, when the bound record carries one. */
  readonly _recordDisplay?: string
  readonly _recordTable?: string
  readonly action?: { readonly label: string; readonly href: string }
  /** A text detail's declared format, the grid column vocabulary. */
  readonly format?: ColumnFormat
  /** The stored value a formatted text detail reads, stamped by the binding pass. */
  readonly _formatValue?: unknown
  readonly _formatField?: string
}

/** What a row's `<dd>` reads, given the render context a field detail needs. */
interface DetailContext {
  readonly tables: Tables | undefined
  readonly lang: string
  readonly languages: Languages | undefined
}

/**
 * A text detail through its declared format, as a grid column reads the same
 * value: the stored value the binding pass stamped, else the detail as written
 * (a list with no bound record). Empty stays empty, so the row draws its dash.
 */
function formattedTextDetail(
  item: DescriptionItem,
  format: ColumnFormat,
  context: DetailContext
): ReactNode {
  const value = '_formatValue' in item ? item._formatValue : item.detail
  if (value === undefined || value === null || value === '') return undefined
  const text = formatRecordValue(value, {
    table: context.tables?.find((table) => table.name === item._recordTable),
    fieldName: item._formatField,
    format,
    locale: context.lang,
    languages: context.languages,
    tables: context.tables,
  })
  if (text === undefined || text === '') return item.detail
  // A relative reading carries its instant and its absolute moment (`time`).
  const stamp = relativeStampOf(value, format, context.lang, parseSovriumTimezone().zoneId)
  return stamp === undefined ? (
    text
  ) : (
    <time
      dateTime={stamp.dateTime}
      title={stamp.title}
    >
      {text}
    </time>
  )
}

/** The detail node of a row, or `undefined` when it is empty. */
function detailOf(item: DescriptionItem, context: DetailContext): ReactNode {
  if (item.field === undefined && item.format !== undefined) {
    return formattedTextDetail(item, item.format, context)
  }
  if (item.field === undefined) return item.detail === '' ? undefined : item.detail
  if (item._recordDisplay !== undefined) return item._recordDisplay
  return renderFieldDetail({
    fieldName: item.field,
    value: item._recordValue,
    tableName: item._recordTable,
    tables: context.tables,
    lang: context.lang,
  })
}

/**
 * The glyph standing in for a declared-and-empty detail.
 *
 * An em dash rather than a blank line: a blank reads as a rendering accident,
 * where a dash reads as "this fact is empty" — which is exactly what the config
 * said.
 */
const EMPTY_DETAIL = '—'

/**
 * Whether to rule the rows.
 *
 * On by DEFAULT under `rows`, where the rule is what keeps a long list
 * scannable. Unread under `stacked`, whose pairs are separated by whitespace
 * and would be cut in half by a horizontal rule — so the key is not consulted
 * there at all rather than being consulted and ignored.
 */
const dividersOf = (
  source: Readonly<Record<string, unknown>>,
  layout: DescriptionListLayout
): boolean => (layout === 'stacked' ? false : source['dividers'] !== false)

/**
 * One `<dt>`/`<dd>` row, with the row's action — when it has one — INSIDE the
 * detail.
 *
 * A `<dl>` admits `<div>` wrappers and a wrapper admits `<dt>` and `<dd>` and
 * nothing else. Drawing the action as their sibling would be invalid markup
 * rather than a styling choice, and it matters past pedantry: assistive
 * technology pairs a list's terms with their details by exactly that structure,
 * and a stray element inside the group is where the pairing stops being
 * predictable.
 *
 * It goes inside the `<dd>` rather than into a second `<dd>` of its own — both
 * are valid — because the action belongs to the DETAIL it acts on, and a row
 * would otherwise report two details for one term to anything counting the
 * pair.
 */
const renderRow = ({
  item,
  index,
  layout,
  dividers,
  context,
}: {
  readonly item: DescriptionItem
  readonly index: number
  readonly layout: DescriptionListLayout
  readonly dividers: boolean
  readonly context: DetailContext
}): ReactElement => {
  const detail = detailOf(item, context)
  return (
    <div
      key={index}
      data-slot="description-list-item"
      data-description-row=""
      className={computeDescriptionRowClasses({ layout, dividers })}
    >
      <dt
        data-slot="description-list-term"
        className={computeDescriptionTermClasses()}
      >
        {item.term}
      </dt>
      <dd
        data-slot="description-list-detail"
        className={computeDescriptionDetailClasses({
          withAction: item.action !== undefined,
          empty: detail === undefined,
        })}
      >
        {detail === undefined ? (
          <span
            data-description-empty=""
            className={computeDescriptionEmptyClasses()}
          >
            {EMPTY_DETAIL}
          </span>
        ) : (
          detail
        )}
        {item.action === undefined ? undefined : (
          <a
            data-slot="description-list-action"
            data-description-action=""
            href={item.action.href}
            className={computeDescriptionActionClasses()}
          >
            {item.action.label}
          </a>
        )}
      </dd>
    </div>
  )
}

/**
 * `description-list` — the facts about one thing, each named.
 *
 * The root is the author's node and the `<dl>` sits inside it: the author's
 * `props` describe THEIR element, and folding them onto the `<dl>` would make
 * every spacing or testid they wrote a claim about the list's semantics.
 */
export const descriptionListComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  component,
  tables,
  currentLang,
  languages,
}) => {
  const context: DetailContext = { tables, lang: currentLang ?? 'en-US', languages }
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const items = Array.isArray(source['items'])
    ? (source['items'] as readonly DescriptionItem[])
    : []
  const layout: DescriptionListLayout = source['layout'] === 'stacked' ? 'stacked' : 'rows'
  const dividers = dividersOf(source, layout)
  const { className: authorClassName, ...rest } = omitInternalMarkers(elementPropsWithSpacing)

  return (
    <div
      {...rest}
      className={mergePrestyle(
        computeDescriptionListRootClasses(),
        authorClassName as string | undefined
      )}
    >
      <dl
        data-slot="description-list"
        className={computeDescriptionListClasses({ layout })}
      >
        {items.map((item, index) => renderRow({ item, index, layout, dividers, context }))}
      </dl>
    </div>
  )
}
