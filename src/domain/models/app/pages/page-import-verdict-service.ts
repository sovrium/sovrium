/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One board's VERDICT in a page import's report: the nodes whose edit the
 * import carries into the config, the nodes whose edit it keeps the config
 * value for, and the nodes whose edit it refuses. A tool editing a canvas
 * reads it on a dry run to check its own edit before handing the canvas back.
 *
 * Pure: read off the page's own report, the same report always gives the same verdict.
 */

import type { PageImportReport } from '@/domain/models/api/admin/design-system/page-import-report'

type Page = PageImportReport['pages'][number]
type Verdict = NonNullable<PageImportReport['boards']>[number]

/** Each id once, in the order first named. */
const unique = (ids: readonly string[]): readonly string[] => [...new Set(ids)]

/**
 * The verdict of the board a page was read from.
 *
 * @param drawing - the board, as the source names it.
 * @param page - the page's report.
 */
export const boardVerdictOf = (drawing: string, page: Page): Verdict => {
  const carried = unique([
    ...page.moved.map((move) => move.node),
    ...page.added.map((addition) => addition.node),
    ...page.removed,
    ...page.changes.map((change) => change.node),
    ...page.translations.flatMap((change) => (change.written === undefined ? [] : [change.node])),
  ])
  const kept = unique([
    ...page.offScale.map((entry) => entry.node),
    ...page.ignored.map((entry) => entry.node),
    ...page.translations.flatMap((change) => (change.written === undefined ? [change.node] : [])),
  ])
  const refused = unique(page.refused.map((refusal) => refusal.node))
  return {
    drawing,
    page: page.name,
    unchanged:
      carried.length === 0 &&
      kept.length === 0 &&
      refused.length === 0 &&
      (page.conflicts ?? []).length === 0,
    carried,
    kept,
    refused,
  }
}
