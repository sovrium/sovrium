/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `list` drawn through a `children` row template, on a shared-filter channel.
 *
 * Its rows are expanded on the server, which owns `$record` and every per-row
 * gate, so no island can redraw them: the channel has to reach the server's
 * read instead. Two halves, one per moment:
 *
 *  - {@link narrowChannelRowLists} runs on the page tree before the rows are
 *    read. It finds each such list, stamps it as a region the client runtime
 *    refreshes when the channel changes (`channel-region-refresh.ts`), and
 *    hands it the channel's conditions as a private marker. The conditions are
 *    the ones the page ADDRESS carries for the channel (`?<channel>.<param>=`,
 *    the address a bar mirrors itself in, and the one the client re-reads the
 *    page under), else the opening conditions of the channel's bars — the same
 *    expression the bar's hidden input already serves.
 *  - {@link withChannelFilter} runs where the list's own read is built, once
 *    the reader's field grants are known. It spends the marker and keeps only
 *    the conditions on a field the table declares and the reader may read: the
 *    address is the reader's to write, and a condition on a column hidden from
 *    her would tell her what it holds.
 */

import { mapObjectNodes, objectNodes } from '@/domain/kernel/config-parsing/config-node-walk'
import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { channelDataFilters } from '@/domain/models/app/pages/channel-row-filter-service'
import {
  utcCalendarDay,
  utcMinuteInstant,
} from '@/domain/models/app/pages/components/relative-date-filter'
import { buildFilterExpression } from '@/presentation/design/filter-expression'
import { renderNow } from '@/presentation/render/page/render-clock'
import { rewriteComponent, tableBindingOf } from './component-rewrite'
import type { Page } from '@/domain/models/app/pages'
import type { ChannelClock } from '@/domain/models/app/pages/channel-row-filter-service'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { FilterBarCondition, FilterBarField } from '@/presentation/design/filter-expression'

/** The private resolver-to-resolver marker carrying a list's channel conditions. */
const CHANNEL_FILTER = '_channelFilter'

/** The attribute naming a refreshed region's channel, read by the client runtime. */
const CHANNEL_REGION = 'data-channel-region'

type Node = Readonly<Record<string, unknown>>

/** What a channel carries: its params and conditions, each a string. */
type ChannelBag = Readonly<Record<string, string>>

/** The channel a list binding listens on, when it reads rows of a table the server draws. */
const listenedChannel = (dataSource: Node): string | undefined => {
  const { bindTo, mode } = dataSource
  if (typeof bindTo !== 'string' || dataSource['sharedFilter'] === undefined) return undefined
  const drawnRows =
    mode !== 'search' && mode !== 'single' && typeof dataSource['table'] === 'string'
  return drawnRows ? bindTo : undefined
}

/**
 * The channel a server-drawn row-template list listens on, if it is one: a
 * `children` row template and no `listDisplay.itemTemplate`, which would make
 * it the list island (`isListIslandMode`), a subscriber in its own right.
 */
const rowListChannel = (node: Node): string | undefined => {
  const { dataSource, children, listDisplay } = node
  if (node['type'] !== 'list' || !isRecord(dataSource)) return undefined
  const drawsRows = Array.isArray(children) && children.length > 0
  const island = isRecord(listDisplay) && listDisplay['itemTemplate'] !== undefined
  return drawsRows && !island ? listenedChannel(dataSource) : undefined
}

/** The `[channel, opening expression]` a filter bar publishes, when `node` is one. */
const openingOf = (node: Node): readonly (readonly [string, string])[] => {
  const { publishes, conditions, fields, combinator } = node
  if (node['type'] !== 'filter-bar' || !isRecord(publishes)) return []
  const channel = publishes['bindTo']
  if (typeof channel !== 'string') return []
  const expression = buildFilterExpression(
    Array.isArray(conditions) ? (conditions as readonly FilterBarCondition[]) : [],
    Array.isArray(fields) ? (fields as readonly FilterBarField[]) : [],
    combinator === 'or' ? 'or' : 'and'
  )
  return [[channel, expression]]
}

/** What the address says of `channel`, or `undefined` when it names none of its params. */
const addressedBag = (channel: string, query: ChannelBag | undefined): ChannelBag | undefined => {
  const prefix = `${channel}.`
  const entries = Object.entries(query ?? {}).filter(([key]) => key.startsWith(prefix))
  return entries.length === 0
    ? undefined
    : Object.fromEntries(entries.map(([key, value]) => [key.slice(prefix.length), value]))
}

/** `node` stamped and handed its channel's conditions, when it is a row-template list on one. */
const stamped = (node: Node, bagOf: (channel: string) => ChannelBag, clock: ChannelClock): Node => {
  const channel = rowListChannel(node)
  if (channel === undefined) return node
  const conditions = channelDataFilters(bagOf(channel), clock)
  const props = isRecord(node['props']) ? node['props'] : {}
  const marker =
    conditions !== undefined && conditions.length > 0 ? { [CHANNEL_FILTER]: conditions } : {}
  return { ...node, props: { ...props, [CHANNEL_REGION]: channel, ...marker } }
}

/** The UTC day and minute instant of `instant`, which a channel's relative dates name. */
const clockAt = (instant: Readonly<Date>): ChannelClock => ({
  today: utcCalendarDay(instant),
  now: utcMinuteInstant(instant),
})

/**
 * The page, each server-drawn row-template list on a channel stamped as a
 * refreshable region and handed the channel's current conditions, their
 * relative dates resolved against `clock` (by default the render's own day and
 * minute, the ones the page's other filters read).
 */
export function narrowChannelRowLists(
  page: Page,
  query: Readonly<Record<string, string>> | undefined,
  clock: ChannelClock = clockAt(renderNow())
): Page {
  const openings = new Map(objectNodes(page.components).flatMap(openingOf))
  const bagOf = (channel: string): ChannelBag => {
    const opening = openings.get(channel)
    return addressedBag(channel, query) ?? (opening === undefined ? {} : { filter: opening })
  }
  const components = mapObjectNodes(page.components, (node) => stamped(node, bagOf, clock))
  return { ...page, components: components as Page['components'] }
}

/** The view of a table the channel conditions are judged against. */
interface ChannelTable {
  readonly fields: readonly { readonly name: string }[]
}

/**
 * `component` with its channel conditions spent into its own filter: those on
 * a field `table` declares and outside `restricted`, the reader's hidden set.
 * A value its column cannot hold is not judged here: the channel's conditions
 * join the list's own `filter`, and the read refuses such a value in every one
 * of them alike (`pageReadFilterOf`), an `in` list keeping the values it can.
 */
export function withChannelFilter(
  component: Component,
  table: ChannelTable,
  restricted: ReadonlySet<string>
): Component {
  const props = component.props as Readonly<Record<string, unknown>> | undefined
  if (props === undefined || !(CHANNEL_FILTER in props)) return component
  const { [CHANNEL_FILTER]: published, ...rest } = props
  const declared = new Set(['id', ...table.fields.map((field) => field.name)])
  const kept = (published as readonly DataFilter[]).filter(
    (condition) => declared.has(condition.field) && !restricted.has(condition.field)
  )
  const dataSource = tableBindingOf(component)
  if (dataSource === undefined) return rewriteComponent(component, { props: rest })
  const filter = [...(dataSource.filter ?? []), ...kept]
  return rewriteComponent(component, { props: rest, dataSource: { ...dataSource, filter } })
}
