/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The collection-page variant of `$record` substitution: a page bound to one
 * record fills that record into its components, and stops at every node whose
 * own `dataSource` still has rows to draw. The rows themselves are drawn by
 * `data-source-rows.ts`.
 */

import {
  substituteRecordVars,
  withRecordText,
} from '@/domain/models/app/pages/substitute-record-vars'
import { readsAnotherRecord } from './bound-node-record'
import { componentField, entryAsComponent, rewriteComponent } from './component-rewrite'
import { walkComponentSlots, type ComponentListEntry } from './component-slot-walk'
import {
  expandRepeat,
  isRepeating,
  pageScopeReads,
  type RecordScope,
} from './record-repeat-expansion'
import {
  RECORD_VALUE_TYPES,
  injectRecordFieldValue,
  substituteRecordInContent,
  substituteRecordInDataSource,
  withPlainTextPin,
} from './record-substitution'
import { buildRecordTemplatePatch, substituteRecordInProps } from './record-template-substitution'
import { filterChildrenForRecord, labelsFollowingRecord } from './record-visibility'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Variant of `substituteRecordInComponent` used by the collection-page
 * resolver to substitute the parent collection record's fields into the
 * page's components (the pages access publishing requirement — Category & Tag
 * Patterns).
 *
 * The key difference from `substituteRecordInComponent`: when a component
 * declares a `dataSource`, its `children` are LEFT UNSUBSTITUTED: they are
 * per-row templates `expandDataSourceChildren` fills against each fetched row.
 * Pre-substituting them with the parent category/tag record would
 * clobber the inner `$record.*` tokens (eg. `$record.title` of a post)
 * with the parent's fields (eg. `$record.title` of a category), making
 * row-level data binding impossible.
 *
 * `dataSource.filter[].value` IS substituted — the parent record drives
 * cross-table filtering (`value: '$record.name'`) — and so are props and content,
 * unless the node reads one record of its own ({@link readsAnotherRecord}).
 */
export function substituteRecordInCollectionTemplate(
  component: Component,
  record: Record<string, unknown>,
  tableName?: string,
  scope?: RecordScope
): Component {
  // A `record-field` (or a field-bound control) needs the bound record's raw
  // value injected, as under a single-mode dataSource. Without this it renders
  // empty on every collection page while `$record.*` resolves normally.
  if (RECORD_VALUE_TYPES.has(component.type)) {
    return injectRecordFieldValue(component, record, tableName)
  }

  // `scope` is the PAGE binding's: what `$record.` may print there, plus the two
  // things only a page bound to one record does — expand a `repeat`, and print a
  // lone object token in a `code` node as JSON.
  const { printable, json } = pageScopeReads(component, record, scope)
  const resolvedContent = substituteRecordInContent(componentField(component, 'content'), printable)
  const baseProps = withPlainTextPin(
    component.props ? substituteRecordInProps(component.props, printable) : component.props,
    resolvedContent.forcePlainText
  )
  const baseContent = json ?? resolvedContent.content
  const templatePatch = buildRecordTemplatePatch(component, record, tableName)
  const dataSource = componentField(component, 'dataSource')
  if (dataSource) {
    return rewriteComponent(component, {
      ...(readsAnotherRecord(component, tableName)
        ? {}
        : { props: baseProps, content: baseContent, ...templatePatch }),
      dataSource: substituteRecordInDataSource(dataSource, record),
    }) // Children left UNSUBSTITUTED — per-row templates expanded later.
  }

  const own = rewriteComponent(component, {
    props: baseProps,
    content: baseContent,
    ...templatePatch,
  })
  if (scope !== undefined && isRepeating(component)) return expandRepeat(own, scope)
  // Slots (a card's `footer`) are walked as `children` are. A string entry is
  // an escaped React child (see `substituteRecordInComponent`): never escape it here.
  const walk = (entries: readonly ComponentListEntry[]): readonly ComponentListEntry[] =>
    filterChildrenForRecord(entries, record).map((child) =>
      typeof child === 'string'
        ? substituteRecordVars(child, withRecordText(printable))
        : substituteRecordInCollectionTemplate(entryAsComponent(child), record, tableName, scope)
    )
  const children = component.children ?? []
  return rewriteComponent(own, {
    ...walkComponentSlots(component, walk),
    children: walk(children),
    ...labelsFollowingRecord(own, children, record),
  })
}
