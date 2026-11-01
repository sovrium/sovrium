/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { stripStorageKeyUuidPrefix } from '@/domain/kernel/identity/storage-key'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { bestEffort } from '@/infrastructure/logging/best-effort'
import { notClaimed } from '@/infrastructure/storage/catalog-claim'
import type { AdminSearchUpsertRow } from '@/application/ports/repositories/admin-search-repository'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { Dialect } from '@/infrastructure/database/drizzle/layer'

/**
 * The admin search index's five fixed sources — form submissions, automation
 * runs, users, files and agent conversations — each read into secret-free
 * index rows, dated by the moment its entity happened.
 *
 * Every reader is resilient: a missing or unreadable source table yields no
 * rows rather than aborting the rebuild, and is logged with its cause so a
 * broken source never reads as "no results". A title
 * holds the entity's own name and never a word for its KIND: the index is
 * built once and read by operators in every language, so the kind travels as
 * `type` and is named at read time, in the reader's language.
 */

/**
 * The moment a source row records — dialect-native (`Date` on PostgreSQL,
 * epoch milliseconds on SQLite) — capped at `now`, the rebuild instant.
 *
 * Capped because the newest row's `updated_at` is the index's freshness marker
 * (`indexStaleness`): a row dated after the rebuild — a clock running ahead of
 * the wall clock — would read as a fresh index forever. A missing or
 * unreadable moment reads as `now`.
 */
const momentOf = (raw: unknown, now: Readonly<Date>): Date => {
  const parsed =
    raw instanceof Date
      ? raw
      : typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw))
        ? new Date(Number(raw))
        : typeof raw === 'string'
          ? new Date(raw)
          : undefined
  if (parsed === undefined || Number.isNaN(parsed.getTime())) return new Date(now.getTime())
  return parsed.getTime() > now.getTime() ? new Date(now.getTime()) : parsed
}

/**
 * Read form submissions into index rows — METADATA ONLY.
 *
 * THE SUBMITTED BODY IS PERMANENTLY OUT OF THE FTS DOCUMENT, and the reason is
 * a confidentiality boundary rather than a scoping preference. Revealing a
 * submission body needs `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` AND
 * `isAdminRole` (`forms-overview.ts` `BuildSubmissionDetail`); with the env var
 * unset — the default — that endpoint 403s for EVERY caller. This index needs
 * neither: `/api/admin/search` sits behind the `/api/admin/*` `requireAdminTier`
 * catch-all, which admits `admin-editor` / `admin-viewer` / `operator` alike.
 *
 * So while the search never RETURNS body text (`toHit` projects
 * `type/entity_id/title/href/updated_at` only), indexing the body made
 * `?q=<substring>` a CONFIRM/DENY ORACLE: a hit iff the substring sits in a
 * withheld body, recoverable one substring at a time by a tier that may list
 * submissions it may not read. Sanitizing the response would not have closed
 * it; only narrowing the haystack does.
 *
 * What stays searchable is what the operator can already see on the list
 * surface: the form NAME (carried as `title`) and the submission ID (carried as
 * `body`, since the FTS document spans `title || ' ' || body` and NOT
 * `entity_id`). The SUBMITTER identity — the other half of the list haystack in
 * is deliberately DEFERRED, not forgotten: it needs a new
 * `auth.user` LEFT JOIN here and would bake an e-mail into a derived store the
 * GDPR account purge does not yet cover. That widening does not belong inside a
 * confidentiality fix; the capability survives via the `user` rows, indexed
 * already.
 *
 * `status` stays out on D3's own reasoning: it is a category match that buries
 * the one row wanted, and it is client-localized.
 */
export const readSubmissions = (
  db: PortableDb,
  dialect: Dialect,
  formTitles: Readonly<Record<string, string>>,
  now: Readonly<Date>
): Promise<readonly AdminSearchUpsertRow[]> =>
  bestEffort('[admin-search] search source unreadable', { source: 'submissions' }).promise(
    executeRawOn(
      dialect.kind,
      db,
      sql`SELECT id AS entity_id, form_name, submitted_at
        FROM ${dialect.sql.systemTableRef('form_submissions')}
        WHERE deleted_at IS NULL AND (status IS NULL OR status <> 'draft') -- a draft was never sent
        LIMIT 500`
    ).then((rows) =>
      rows.map((row): AdminSearchUpsertRow => {
        const entityId = String(row['entity_id'])
        const formName = typeof row['form_name'] === 'string' ? row['form_name'] : entityId
        return {
          type: 'submission',
          entityId,
          // The form as it names itself for people; the slug stays findable
          // through the body.
          title: formTitles[formName] ?? formName,
          // Metadata only — the id and the form's name, so an operator holding
          // either can still find the row. NEVER the submitted payload; see the
          // note above.
          body: `${entityId} ${formName}`,
          href: `/_admin/submissions/${formName}?record=${encodeURIComponent(entityId)}`,
          updatedAt: momentOf(row['submitted_at'], now),
        }
      })
    ),
    []
  )

/** Read automation runs into index rows — never a run whose values were erased with an account. */
export const readRuns = (
  db: PortableDb,
  dialect: Dialect,
  now: Readonly<Date>
): Promise<readonly AdminSearchUpsertRow[]> =>
  bestEffort('[admin-search] search source unreadable', { source: 'runs' }).promise(
    executeRawOn(
      dialect.kind,
      db,
      sql`SELECT r.id AS entity_id, d.name AS automation_name, r.status AS status,
               COALESCE(r.error, '') AS error, COALESCE(r.started_at, r.created_at) AS started_at
        FROM ${dialect.sql.systemTableRef('automation_runs')} AS r
        LEFT JOIN ${dialect.sql.systemTableRef('automation_definitions')} AS d ON d.id = r.automation_id
        WHERE r.values_erased_at IS NULL
        LIMIT 500`
    ).then((rows) =>
      rows.map((row): AdminSearchUpsertRow => {
        const name =
          typeof row['automation_name'] === 'string'
            ? row['automation_name']
            : String(row['entity_id'])
        const status = typeof row['status'] === 'string' ? row['status'] : ''
        const entityId = String(row['entity_id'])
        return {
          type: 'run',
          entityId,
          title: name,
          body: `${status} ${typeof row['error'] === 'string' ? row['error'] : ''}`.trim(),
          href: `/_admin/runs/${encodeURIComponent(entityId)}`,
          updatedAt: momentOf(row['started_at'], now),
        }
      })
    ),
    []
  )

/** Read users into index rows (email + display name; never a password hash). */
export const readUsers = (
  db: PortableDb,
  dialect: Dialect,
  now: Readonly<Date>
): Promise<readonly AdminSearchUpsertRow[]> => {
  const userTable: SQL = dialect.kind === 'sqlite' ? sql.raw('auth_user') : sql.raw('auth."user"')
  return bestEffort('[admin-search] search source unreadable', { source: 'users' }).promise(
    executeRawOn(
      dialect.kind,
      db,
      sql`SELECT id AS entity_id, email, name, created_at FROM ${userTable} LIMIT 500`
    ).then((rows) =>
      rows.map((row): AdminSearchUpsertRow => {
        const email = typeof row['email'] === 'string' ? row['email'] : ''
        const name = typeof row['name'] === 'string' ? row['name'] : ''
        const title = email.length > 0 ? email : name || String(row['entity_id'])
        return {
          type: 'user',
          entityId: String(row['entity_id']),
          title,
          body: name,
          href: '/_admin/users',
          updatedAt: momentOf(row['created_at'], now),
        }
      })
    ),
    []
  )
}

/**
 * Read file metadata into index rows (file name only) — the name the Files page
 * prints: the stored value carries a random `<uuid>-` prefix, stripped here.
 */
export const readFiles = (
  db: PortableDb,
  dialect: Dialect,
  now: Readonly<Date>
): Promise<readonly AdminSearchUpsertRow[]> =>
  bestEffort('[admin-search] search source unreadable', { source: 'files' }).promise(
    executeRawOn(
      dialect.kind,
      db,
      sql`SELECT id AS entity_id, filename, created_at
        FROM ${dialect.sql.systemTableRef('file_storage_metadata')}
        WHERE ${notClaimed()}
        LIMIT 500`
    ).then((rows) =>
      rows.map((row): AdminSearchUpsertRow => {
        const filename =
          typeof row['filename'] === 'string'
            ? stripStorageKeyUuidPrefix(row['filename'])
            : String(row['entity_id'])
        return {
          type: 'file',
          entityId: String(row['entity_id']),
          title: filename,
          // The name's words, apart: PostgreSQL's parser reads `a-b.pdf` as one
          // file-path token, so a word of the name would not find it.
          body: filename
            .split(/[^\p{L}\p{N}]+/u)
            .join(' ')
            .trim(),
          href: '/_admin/files',
          updatedAt: momentOf(row['created_at'], now),
        }
      })
    ),
    []
  )

/** Read agent conversations into index rows (title/agent only). */
export const readConversations = (
  db: PortableDb,
  dialect: Dialect,
  now: Readonly<Date>
): Promise<readonly AdminSearchUpsertRow[]> =>
  bestEffort('[admin-search] search source unreadable', { source: 'conversations' }).promise(
    executeRawOn(
      dialect.kind,
      db,
      sql`SELECT id AS entity_id, COALESCE(title, '') AS title, COALESCE(agent_name, '') AS agent_name,
               updated_at
        FROM ${dialect.sql.systemTableRef('ai_conversations')}
        LIMIT 500`
    ).then((rows) =>
      rows.map((row): AdminSearchUpsertRow => {
        const title =
          typeof row['title'] === 'string' && row['title'].length > 0
            ? row['title']
            : typeof row['agent_name'] === 'string' && row['agent_name'].length > 0
              ? row['agent_name']
              : String(row['entity_id'])
        return {
          type: 'conversation',
          entityId: String(row['entity_id']),
          title,
          body: typeof row['agent_name'] === 'string' ? row['agent_name'] : '',
          href: '/_admin/conversations',
          updatedAt: momentOf(row['updated_at'], now),
        }
      })
    ),
    []
  )
