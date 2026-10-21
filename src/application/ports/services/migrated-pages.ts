/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { ExtractedForm } from '@/domain/models/import/extracted-form'
import type { ImportSnapshotManifest } from '@/domain/models/import/snapshot-manifest'

/**
 * The page converter `sovrium import` calls when a snapshot holds a page
 * export — a Webflow site-export ZIP, a Retool classic ToolScript ZIP, a
 * Notion workspace export ZIP ([internal ref] A14, pages part).
 *
 * The pages programme owns the converter (`planMigratedPages`) and the shape
 * of the report's `pages` section; the import owns the snapshot it reads and
 * the one call site. This port is the seam between them: the import calls
 * `planMigratedPages` through it and nothing else, so the converter plugs in
 * by providing {@link MigratedPages} — or by changing the default below — and
 * the import's code does not change.
 *
 * The converter reads the snapshot and the config's spacing scale, nothing
 * else: no network (pages never use `fetch`), no clock, no environment. The
 * scale is what a layout value is written on, so the import hands it over. It runs BEFORE the single AppSchema
 * decode of the migrated app, and its `forms` are mapped by the forms mapper
 * after it, so a page's form node always names an emitted form.
 */

/** A snapshot as the page converter reads it: its manifest and its `raw/` bytes. */
export interface MigrationSnapshot {
  readonly manifest: ImportSnapshotManifest
  /** Every file under `raw/`, by its snapshot path (`raw/site-export.zip`). */
  readonly raw: ReadonlyMap<string, Uint8Array>
}

/** What the page converter returns. */
export interface MigratedPagesPlan {
  /** The new page entries, never merged into existing ones. */
  readonly pages: readonly unknown[]
  /** The report's `pages` section, shaped by the pages programme. */
  readonly report: unknown
  /** The forms the pages hold, for the forms mapper. */
  readonly forms: readonly ExtractedForm[]
}

/** What the config already holds that a page converter reads. */
export interface MigratedPagesTarget {
  /** `design.spacing`: a step name to its CSS length, the scale every gap is written on. */
  readonly spacing?: Readonly<Record<string, string>> | undefined
}

/** The converter, or `undefined` when no page converter is installed. */
export interface MigratedPagesConverter {
  readonly planMigratedPages:
    ((snapshot: MigrationSnapshot, target?: MigratedPagesTarget) => MigratedPagesPlan) | undefined
}

/** The report's `pages` section while no converter is installed. */
export const PENDING_PAGES_REPORT = {
  status: 'pending',
  message: 'pages: pending the pages converter',
} as const

/**
 * The installed page converter. A `Reference` whose default holds none, so the
 * import reports the pages as pending instead of failing to resolve a service.
 */
export const MigratedPages = Context.Reference<MigratedPagesConverter>('MigratedPages', {
  defaultValue: () => ({ planMigratedPages: undefined }),
})
