/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateAssetReferences } from './asset-reference-validation'
import { validateApprovalTimeouts } from './automations/actions/approval/approval-timeout-validation'
import { validateDelayLimits } from './automations/actions/delay/delay-limits-validation'
import { validateRecordAggregates } from './automations/actions/record/aggregate-validation'
import { validateRecordEventLoops } from './automations/record-loop-validation'
import { validatePreviewOptionPaths } from './design/preview-option-validation'
import { validateDocumentOutputBuckets } from './document-output-validation'
import { validateGrantActions } from './grant-action-validation'
import { validateComponentFieldReferences } from './pages/components/component-field-references'
import { validateComponentSemantics } from './pages/components/component-types/component-semantic-validation'
import { validateComponentXorRules } from './pages/components/component-types/component-xor-rules'
import { validateCalendarColorFields } from './pages/components/component-types/data/calendar/calendar-color-field-validation'
import { validateCardSlotComponents } from './pages/components/component-types/data/card-slot-validation'
import { validateAggregateSeries } from './pages/components/component-types/data/chart/aggregate-series-validation'
import {
  validateDataTableFieldReferences,
  validateRowColorFields,
} from './pages/components/component-types/data/table/schema'
import { validateDrawerRelatedReferences } from './pages/components/component-types/overlays/drawer-related-validation'
import { validateRelativeDateFilters } from './pages/components/relative-date-filter'
import { validateDataSourceRefreshModes } from './pages/data-source-refresh-validation'
import { validateDataSourceViewReferences } from './pages/data-source-view-validation'
import { validateGraphTablesSources } from './pages/graph-tables-source-validation'
import { validateTableNameReferences } from './pages/table-name-references'
import { validateComputedFieldForeignKeys } from './tables/computed-field-foreign-key-validation'
import type { App } from './app'

/**
 * THE registry of the cross-field rules the per-property decode cannot express,
 * run once by the config-decode pipeline after `AppSchema` accepts a config.
 *
 * ONE HOME. These rules were a hand-written spread inside the decode pipeline,
 * beside two other homes (the `Schema.check` filters on `AppSchema`, and the
 * CLI's own post-decode sweeps). A rule here is data: an id, and a function of
 * the decoded config and the config as written. Order is the array's order and
 * is part of the contract — the first message a refused config prints, and the
 * `sovrium validate` specs that assert it, depend on it.
 *
 * WHAT IS NOT HERE, AND WHY.
 *  - The `AppSchema` filters: they run INSIDE the decode, so a config they
 *    refuse never reaches this list. Their bodies are named siblings of
 *    `app.ts` (`app-*-validation.ts`).
 *  - The CLI's post-decode sweeps (`runPostDecodeChecks` in `validate.ts`): they
 *    read the filesystem and run the TypeScript checker, so they are not pure
 *    and cannot be domain rules. Each also documents why boot does not run it.
 *
 * DECODED OR AS WRITTEN. Each entry reads one or the other, never both:
 *  - `decoded` where the rule needs the config's TYPED shape and nothing the
 *    decode may have filled in changes its verdict: computed-field foreign
 *    keys, document output buckets, grant actions.
 *  - `raw` everywhere else. The page and component rules walk the page tree
 *    STRUCTURALLY (`kernel/config-parsing/config-node-walk.ts`), which a typed
 *    walk over the ninety-branch component union cannot do without failing
 *    open on a branch nobody listed, and they name paths in the document as the
 *    author wrote it. The automation and asset rules are written schema-import-
 *    free on purpose (each says so at its head), so they read the document too.
 *
 * Pure: every rule returns its messages, empty when the config is clean.
 */

/** One cross-field rule: its stable id, and the messages it refuses a config with. */
export interface AppSemanticCheck {
  readonly id: string
  readonly run: (decoded: App, raw: unknown) => readonly string[]
}

/** Every cross-field rule, in the order its messages are reported. */
export const APP_SEMANTIC_CHECKS: readonly AppSemanticCheck[] = [
  {
    id: 'computedFieldForeignKeys',
    run: (decoded) => validateComputedFieldForeignKeys(decoded),
  },
  { id: 'dataTableFieldReferences', run: (_, raw) => validateDataTableFieldReferences(raw) },
  // The table NAME, wherever it is bound. Ordered before the field sweep
  // because it is the verdict that sweep DEFERS to: a component whose table
  // does not resolve is skipped there. See `table-name-references.ts`.
  { id: 'tableNameReferences', run: (_, raw) => validateTableNameReferences(raw) },
  // `dataSource.view` and `refreshMode` where they cannot apply; graph/matrix table sources.
  { id: 'dataSourceViewReferences', run: (_, raw) => validateDataSourceViewReferences(raw) },
  { id: 'dataSourceRefreshModes', run: (_, raw) => validateDataSourceRefreshModes(raw) },
  { id: 'graphTablesSources', run: (_, raw) => validateGraphTablesSources(raw) },
  { id: 'componentFieldReferences', run: (_, raw) => validateComponentFieldReferences(raw) },
  { id: 'rowColorFields', run: (_, raw) => validateRowColorFields(raw) },
  // A calendar's colour names one option, never a multi-select (its module).
  { id: 'calendarColorFields', run: (_, raw) => validateCalendarColorFields(raw) },
  // A drawer's `related` sections need `tables[]`, which no drawer schema node sees.
  { id: 'drawerRelatedReferences', run: (_, raw) => validateDrawerRelatedReferences(raw) },
  // Card slots hold record components; the other component-type rules gathered.
  { id: 'cardSlotComponents', run: (_, raw) => validateCardSlotComponents(raw) },
  { id: 'componentSemantics', run: (_, raw) => validateComponentSemantics(raw) },
  // One `series` styles an aggregated chart.
  { id: 'aggregateSeries', run: (_, raw) => validateAggregateSeries(raw) },
  // A relative-date value is a grammar token.
  { id: 'relativeDateFilters', run: (_, raw) => validateRelativeDateFilters(raw) },
  // A record automation re-firing its own trigger.
  { id: 'recordEventLoops', run: (_, raw) => validateRecordEventLoops(raw) },
  // An approval `timeout` must decide its outcome.
  { id: 'approvalTimeouts', run: (_, raw) => validateApprovalTimeouts(raw) },
  // Over-long delays (`delay-limits-validation.ts`).
  { id: 'delayLimits', run: (_, raw) => validateDelayLimits(raw) },
  // A figure over a missing or non-number field.
  { id: 'recordAggregates', run: (_, raw) => validateRecordAggregates(raw) },
  // `{ asset }` paths; `attachTo` into its field's bucket.
  { id: 'assetReferences', run: (_, raw) => validateAssetReferences(raw) },
  { id: 'documentOutputBuckets', run: (decoded) => validateDocumentOutputBuckets(decoded) },
  // A literal grant table or role the app does not declare.
  { id: 'grantActions', run: (decoded) => validateGrantActions(decoded) },
  // Mutually-exclusive component keys. Here rather than in the schema because
  // `buildComponentUnion` has no per-branch refinement hook, so a rule relating
  // an INJECTED key (`children`) to a declared one cannot be written there.
  { id: 'componentXorRules', run: (_, raw) => validateComponentXorRules(raw) },
  // A preview's option PATH, against the options its subject type publishes.
  // Here rather than inside `AppSchema` because the option universe comes from a
  // domain service that introspects the component schemas, and a schema module
  // may not import machinery built over it. See `preview-option-validation.ts`.
  { id: 'previewOptionPaths', run: (_, raw) => validatePreviewOptionPaths(raw) },
]

/** Every message the registry refuses a config with, in registry order. Pure. */
export const runAppSemanticChecks = (decoded: App, raw: unknown): readonly string[] =>
  APP_SEMANTIC_CHECKS.flatMap((check) => check.run(decoded, raw))
