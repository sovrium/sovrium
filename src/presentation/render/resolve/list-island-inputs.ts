/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a client-fetching `list` needs from `app.tables` to print a row the way
 * a grid row prints it.
 *
 * The island only ever sees records, so every fact about the bound table's
 * FIELDS is answered here, on the server, and serialised with the island's
 * props: the currency treatment of each `format: currency` metadata entry, so
 * a euro amount reads `€118,000.00` exactly as the grid cell prints it; and
 * the paint of the badge when it names an option field, so the badge is the
 * grid's chip for the same value.
 */

import {
  resolveOptionBadgePaints,
  type OptionBadgePaints,
} from '@/presentation/render/props/option-badge-paints'
import { resolveValueCurrency } from '@/presentation/render/props/resolve-chart-field-context'
import { resolveWeekdayFields } from '@/presentation/render/props/resolve-weekday-fields'
import type { CalendarWeekday } from '@/domain/kernel/format/calendar-date'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { App } from '@/domain/models/app'
import type { Component } from '@/domain/models/app/pages/components'

/** The table-derived inputs a list island reads. Every key is optional. */
export interface ListIslandInputs {
  readonly currencies?: Readonly<Record<string, CurrencyDisplayOptions>>
  /** What a click on an item does — a grid row's `onRowClick`. */
  readonly onRowClick?: unknown
  /** The badge field's chip paints, by option value, and the field they read. */
  readonly badgePaints?: OptionBadgePaints
  readonly badgeField?: string
  /** The date fields that print their weekday, as the grid prints them. */
  readonly weekdays?: Readonly<Record<string, CalendarWeekday>>
}

interface MetadataEntry {
  readonly field: string
  readonly format?: string
  readonly options?: { readonly currency?: string }
}

interface ListShape {
  readonly dataSource?: { readonly table?: string }
  readonly onRowClick?: unknown
  readonly listDisplay?: {
    readonly itemTemplate?: {
      readonly badge?: string
      readonly metadata?: readonly MetadataEntry[]
    }
  }
}

/**
 * One entry's currency: the bound field's own when it declares one (a
 * `currency` field keeps its code), else the entry's `options.currency` — the
 * only way to say which currency a plain number is in.
 */
function entryCurrency(
  entry: MetadataEntry,
  table: NonNullable<App['tables']>[number]
): CurrencyDisplayOptions | undefined {
  const fromField = resolveValueCurrency(table, entry.field)
  const named = entry.options?.currency
  if (fromField?.currency !== undefined || named === undefined) return fromField
  return { ...fromField, currency: named }
}

/** The currency of every `format: currency` metadata entry, from its field or its options. */
function resolveCurrencies(
  list: ListShape,
  table: NonNullable<App['tables']>[number]
): Readonly<Record<string, CurrencyDisplayOptions>> | undefined {
  const metadata = list.listDisplay?.itemTemplate?.metadata ?? []
  const entries = metadata
    .filter((entry) => entry.format === 'currency')
    .flatMap((entry) => {
      const currency = entryCurrency(entry, table)
      return currency === undefined ? [] : [[entry.field, currency] as const]
    })
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

/** The field a badge slot names, when it is exactly one `$record.<field>` token. */
const badgeFieldOf = (badge: string | undefined): string | undefined =>
  badge === undefined ? undefined : /^\$record\.([A-Za-z_][\w]*)$/.exec(badge.trim())?.[1]

/** The badge's paints, when the badge names exactly one option field. */
function resolveBadgeInputs(
  list: ListShape,
  table: NonNullable<App['tables']>[number],
  app: App
): Pick<ListIslandInputs, 'badgePaints' | 'badgeField'> {
  const badgeField = badgeFieldOf(list.listDisplay?.itemTemplate?.badge)
  if (badgeField === undefined) return {}
  const badgePaints = resolveOptionBadgePaints(table, badgeField, app.design?.badgeForm)
  return badgePaints === undefined ? {} : { badgePaints, badgeField }
}

/** Resolve a list's table-derived inputs; empty when it binds no declared table. */
export function resolveListIslandInputs(
  component: Component,
  app: App | undefined
): ListIslandInputs {
  const list = component as ListShape
  const click = list.onRowClick === undefined ? {} : { onRowClick: list.onRowClick }
  const table = app?.tables?.find((candidate) => candidate.name === list.dataSource?.table)
  if (app === undefined || table === undefined) return click
  const currencies = resolveCurrencies(list, table)
  const weekdays = resolveWeekdayFields(table)
  return {
    ...click,
    ...(currencies === undefined ? {} : { currencies }),
    ...(weekdays === undefined ? {} : { weekdays }),
    ...resolveBadgeInputs(list, table, app),
  }
}
