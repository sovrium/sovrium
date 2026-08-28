/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One-shot boot purge of `_admin_search_index` ([internal ref] R3).
 *
 * ── Why narrowing the indexer is not enough ───────────────────────────────
 * `rebuildIndex` (admin-search-repository-live.ts) is UPSERT-ONLY — there is no
 * delete pass anywhere in it. So when the indexer stops emitting a column's
 * content, rows it STILL emits get their `body` overwritten by the next
 * `ON CONFLICT DO UPDATE`, but rows it no longer emits are stranded with the
 * old body FOREVER. For form submissions that is exactly three populations:
 *
 *   - submissions soft-deleted after being indexed (the read is
 *     `WHERE deleted_at IS NULL`),
 *   - submissions past the per-source `LIMIT 500` window,
 *   - hard-deleted submissions.
 *
 * Those are the rows an operator is MOST likely to have hidden, which is why a
 * prospective-only fix leaves the confirm/deny oracle standing precisely where
 * it matters most.
 *
 * ── Why DELETE, and why the WHOLE index ───────────────────────────────────
 * `DELETE` rather than an id-keyed `UPDATE … SET body = ''`: an UPDATE can only
 * reach rows it can enumerate, and the stranded rows are by definition the ones
 * no live source enumerates. The whole index rather than `type = 'submission'`:
 * it needs no version flag to stay idempotent, and it is justified on its own
 * terms — `_admin_search_index` is a DERIVED CACHE, rebuilt from live sources by
 * the lazy `rebuildIndex` the first time anyone searches, so it has no business
 * surviving a process restart at all. (It also incidentally closes the GDPR
 * residue noted in [internal ref] R5, where an erased user's e-mail persisted in the
 * index because the rebuild never deleted. Incidental coverage is not a
 * contract — that gap keeps its own follow-up.)
 *
 * ── Ordering, and the SQLite trap ─────────────────────────────────────────
 * MUST run AFTER `runMigrations`, which is where `adminSearchFtsBootStatements()`
 * creates the FTS5 virtual table and its content-sync triggers on SQLite. The
 * SQLite index is EXTERNAL-CONTENT: the inverted index lives in the vtab and is
 * kept in step only by those triggers, so deleting a content row without the
 * `…_ad` trigger in place removes the row while its TOKENS SURVIVE in the vtab —
 * a purge that looks like it worked and leaves the oracle intact. Invisible on
 * PostgreSQL, whose `content_tsv` is a generated column on the row itself and
 * disappears with it. `[internal ref]` runs under
 * `eachDialect` for this reason.
 *
 * SQLite's truncate optimization (which would skip the triggers) is disabled by
 * construction here: SQLite only takes it when the table has NO triggers, and
 * the three FTS sync triggers exist by the time this runs.
 *
 * ── Discipline ────────────────────────────────────────────────────────────
 * Log-and-continue, never fail-fast — the discipline of the sibling post-schema
 * startup steps, not of schema init. A database hiccup while dropping a derived
 * cache must not take the app offline; the stale rows survive one more boot and
 * the next boot retries.
 */

import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import { adminSearchContentTableRef } from './repositories/admin-search-repository-live'
import { executeRaw } from './sql/dialect-execute'

/**
 * Drop every row of the admin global-search index so the next lazy rebuild
 * repopulates it from live sources under the current indexing rules.
 *
 * Never throws: a failure is logged and the boot proceeds.
 */
export const runAdminSearchIndexPurge = async (): Promise<void> => {
  try {
    // eslint-disable-next-line functional/no-expression-statements -- the DELETE is the effect; `executeRaw` resolves to a (here empty) row array that has nothing to bind
    await executeRaw(db, sql`DELETE FROM ${adminSearchContentTableRef()}`)
    logDebug('[admin-search] index purged at boot — the next search rebuilds it from live sources')
  } catch (error) {
    logError('[admin-search] boot purge of the search index failed (non-fatal)', error)
  }
}
