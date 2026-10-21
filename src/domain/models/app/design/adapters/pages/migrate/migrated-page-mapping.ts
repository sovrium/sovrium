/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { EngineComponentType } from '@/domain/models/app/pages/components/component-types/component-type-union'
import type { TextElementSchema } from '@/domain/models/app/pages/components/component-types/content'
import type { LayoutProperty } from '@/domain/models/app/pages/page-merge-layout-service'

/**
 * The vocabulary the three page migration tables share: Webflow
 * (`webflow-page-mappings.ts`), Retool classic (`retool-classic-page-mappings.ts`)
 * and Notion (`notion-page-mappings.ts`).
 *
 * A page from another tool's export reaches Sovrium through ONE committed table
 * per source and nothing outside it: a foreign component the table does not
 * hold is reported, never approximated into the nearest kit type that would
 * validate. Each table is data and decides nothing at run time; the converter
 * (`planMigratedPages`) reads it, and so do the tests that hold every target to
 * the real component union.
 *
 * ─── FOUR OUTCOMES, AND ABSENCE IS THE FIFTH ──────────────────────────────
 *
 * - `node`: the component becomes one kit node of `type`.
 * - `absorbed`: the component is part of an ancestor's description (a form's
 *   inputs and messages become the `ExtractedForm` the form node names; a tab
 *   strip's links become the panels of its `tabs` node) and draws no node of
 *   its own.
 * - `transparent`: the component is a wrapper with no meaning of its own (a
 *   rich-text block, a Notion column list's single column); its children are
 *   mapped in its place.
 * - `left-behind`: the component is data, not page (a Notion inline
 *   database); it is named in the report for the data migration that follows.
 * - Not in the table at all: the component is reported as unmapped, with
 *   where it sat, and nothing is drawn for it.
 *
 * ─── A REQUIRED KEY THE SOURCE DOES NOT HOLD ──────────────────────────────
 *
 * Some kit types need a value to validate (a `description-list` its items, a
 * `collapsible` its trigger label). `requires` names it. When the source
 * component does not carry that value literally — because it reads it through
 * a binding, say — the node is reported as unmapped rather than given a
 * placeholder: an invented value is exactly the approximation the bound
 * refuses.
 */

/** The page sources a migration reads, as `sovrium import --from` names them. */
export const MIGRATION_PAGE_SOURCES = ['webflow', 'retool-classic', 'notion'] as const

/** One page source. */
export type MigrationPageSource = (typeof MIGRATION_PAGE_SOURCES)[number]

/**
 * The pinned format facts each source's table was written against, as the
 * folder under `[internal ref]`. An export that
 * matches none of the shapes pinned there is refused, naming this folder.
 *
 * @public Read by the page migration converter and its report.
 */
export const MIGRATION_PAGE_FACTS: Readonly<Record<MigrationPageSource, string>> = {
  webflow: 'webflow/2.2.2',
  'retool-classic': 'retool/classic-2026-10-19',
  notion: 'notion/2026-10-19',
}

/** A text element, or the heading level the source element's own tag states. */
type MappedTextElement = typeof TextElementSchema.Type | 'source-tag'

/** What a mapped component holds once it is a kit node. */
export type MappedNodeHolds = 'children' | 'content' | 'nothing'

/** A foreign component that becomes one kit node. */
export interface MappedNode {
  readonly outcome: 'node'
  /** The kit type it becomes. */
  readonly type: EngineComponentType
  /** For a `text` node: the element it renders as. */
  readonly element?: MappedTextElement
  /** Whether its foreign children, its text, or neither carry across. */
  readonly holds: MappedNodeHolds
  /** The kit keys the node cannot validate without; see the module note. */
  readonly requires?: readonly string[]
  /** Why this target, in a sentence. */
  readonly note: string
}

/** A foreign component folded into the description of a mapped ancestor. */
export interface AbsorbedComponent {
  readonly outcome: 'absorbed'
  /** The ancestor whose description holds it. */
  readonly into: 'form' | 'tabs' | 'collapsible' | 'table' | 'select' | 'parent'
  readonly note: string
}

/** A foreign wrapper whose children are mapped in its place. */
export interface TransparentComponent {
  readonly outcome: 'transparent'
  readonly note: string
}

/** A foreign component that is data rather than page, named for a later migration. */
export interface LeftBehindComponent {
  readonly outcome: 'left-behind'
  readonly note: string
}

/** One row of a source's component table. */
export type MigratedComponentMapping =
  MappedNode | AbsorbedComponent | TransparentComponent | LeftBehindComponent

/** A source's component table: the component as the source names it, to its outcome. */
export type MigratedComponentTable = Readonly<Record<string, MigratedComponentMapping>>

/**
 * A layout property a migration reads: the round trip's container vocabulary
 * (`direction`, `gap`, `align`, `justify`, `padding`, `width`) plus `columns`,
 * the equal-column count of a grid, which only a migration reads.
 */
export type MigratedLayoutProperty = LayoutProperty | 'columns'

/** The most equal columns a migrated grid may declare; more is reported. */
export const MIGRATED_GRID_MAX_COLUMNS = 12

/** One row of a source's layout table. */
export interface MigratedLayoutRule {
  /** The kit property the source construct sets. */
  readonly property: MigratedLayoutProperty
  readonly note: string
}

/** A source's layout table: the construct as the source writes it, to the kit property. */
export type MigratedLayoutTable = Readonly<Record<string, MigratedLayoutRule>>

/** A source's whole mapping: its components and its layout. */
export interface MigratedPageMappings {
  readonly source: MigrationPageSource
  readonly components: MigratedComponentTable
  readonly layout: MigratedLayoutTable
}
