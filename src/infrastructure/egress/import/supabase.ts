/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Supabase fetcher: a project's database, read as a Retool Database is,
 * then the bytes of its storage objects, read through the Storage API.
 *
 * - **One read-only transaction** (`acquireReadOnly`) reads the catalogue and
 *   rows of `public`, then Supabase's own tables the conversion needs: which
 *   `public` tables enforce row-level security, their policies as `pg_policies`
 *   deparses them, `auth.users` WITHOUT `encrypted_password`, the enum labels,
 *   the columns that reference `auth.users`, and — when buckets are read —
 *   `storage.buckets`, `storage.objects` and the storage policies by name.
 *   Each read is aggregated to JSON by PostgreSQL itself, so a `bigint` or an
 *   array reaches the snapshot as the database spells it.
 * - **The object bytes** are downloaded afterwards, one `GET` per object the
 *   transaction listed, with the service-role key as both `apikey` and bearer
 *   token, sent to the project URL only.
 * - **Secrets.** The connection URL and the key are handed in by the caller,
 *   used, and written nowhere; a failure message never carries either.
 */

import { Effect, Option } from 'effect'
import { SUPABASE_PATHS } from '@/domain/models/import/vendors/supabase-adapter-service'
import { downloadSourceAsset } from './download'
import {
  acquireReadOnly,
  bytesOf,
  fetchTablesAndRows,
  query,
  type PostgresFetchContext,
} from './retool-database'
import type { ImportFetchError } from './client'
import type { FetchSummary, SnapshotSink } from './sink'
import type { SQL } from 'bun'

/** Where the object bytes are downloaded from, and the key they are downloaded with. */
export interface SupabaseStorageAccess {
  /** The project origin, `https://<ref>.supabase.co` (loopback `http` in a test). */
  readonly origin: string
  readonly serviceRoleKey: string
}

/** What the Supabase fetcher is handed beyond a PostgreSQL fetcher's context. */
export interface SupabaseFetchContext extends PostgresFetchContext {
  /** Absent with `--skip-attachments`: every object is then recorded as skipped. */
  readonly storage: SupabaseStorageAccess | undefined
}

const LOOPBACK: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]'])

/** `https`, or plain `http` on a loopback host. */
const isSecure = (url: URL): boolean =>
  url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK.has(url.hostname))

/** Nothing but a scheme and a host: no credentials, no path, no query, no fragment. */
const isBare = (url: URL): boolean =>
  url.username === '' &&
  url.password === '' &&
  url.search === '' &&
  url.hash === '' &&
  url.pathname === '/'

/**
 * The project URL as an origin the key may be sent to, or why it is refused:
 * `https`, or plain `http` on a loopback host, and nothing but scheme and host.
 * The reason names the variable and never repeats its value.
 */
export const supabaseStorageOrigin = (
  value: string,
  variable: string
):
  | { readonly ok: true; readonly origin: string }
  | { readonly ok: false; readonly reason: string } => {
  const url = URL.parse(value)
  return url !== null && isSecure(url) && isBare(url)
    ? { ok: true, origin: url.origin }
    : {
        ok: false,
        reason:
          `${variable} is refused: it must be the project URL over https (plain http is accepted for a loopback host only), ` +
          'with no user name, password, path or query. The service-role key is never sent to any other address.',
      }
}

/** One aggregated read: the rows of `inner`, as the JSON text PostgreSQL built. */
const jsonRows = (
  sql: SQL,
  what: string,
  inner: SQL.Query<unknown>,
  order: SQL.Query<unknown>
): Effect.Effect<readonly unknown[], ImportFetchError> =>
  query(what, () =>
    sql`SELECT COALESCE(json_agg(t ORDER BY ${order}), '[]'::json)::text AS rows
        FROM (${inner}) t`.then((rows: readonly Readonly<Record<string, unknown>>[]) => {
      const parsed = JSON.parse(String(rows[0]?.['rows'] ?? '[]')) as unknown
      return Array.isArray(parsed) ? (parsed as readonly unknown[]) : []
    })
  )

/** Read `inner` and write its rows to `path`; returns them. */
const readInto = (
  sql: SQL,
  sink: SnapshotSink,
  read: {
    readonly what: string
    readonly path: string
    readonly inner: SQL.Query<unknown>
    readonly order: SQL.Query<unknown>
  }
): Effect.Effect<readonly unknown[], ImportFetchError> =>
  jsonRows(sql, read.what, read.inner, read.order).pipe(
    Effect.tap((rows) => sink.writeRaw(read.path, bytesOf(rows)))
  )

/** Supabase's own tables the conversion reads, beside the `public` catalogue. */
const fetchProjectTables = (sql: SQL, sink: SnapshotSink): Effect.Effect<void, ImportFetchError> =>
  Effect.gen(function* () {
    yield* readInto(sql, sink, {
      what: 'the row-level security flags',
      path: SUPABASE_PATHS.rls,
      inner: sql`SELECT c.relname AS "table", c.relrowsecurity AS enabled
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`,
      order: sql`t."table"`,
    })
    yield* readInto(sql, sink, {
      what: 'the policies',
      path: SUPABASE_PATHS.policies,
      inner: sql`SELECT tablename, policyname, permissive, roles::text[] AS roles, cmd, qual, with_check
        FROM pg_policies WHERE schemaname = 'public'`,
      order: sql`t.tablename, t.policyname`,
    })
    yield* readInto(sql, sink, {
      what: 'the users',
      path: SUPABASE_PATHS.authUsers,
      inner: sql`SELECT id, email, phone, raw_user_meta_data, email_confirmed_at, invited_at,
          is_anonymous, deleted_at
        FROM auth.users`,
      order: sql`t.id`,
    })
    yield* readInto(sql, sink, {
      what: 'the enum types',
      path: SUPABASE_PATHS.enums,
      inner: sql`SELECT ty.typname AS name, e.enumlabel AS label, e.enumsortorder AS position
        FROM pg_type ty JOIN pg_enum e ON e.enumtypid = ty.oid
        JOIN pg_namespace n ON n.oid = ty.typnamespace
        WHERE n.nspname = 'public'`,
      order: sql`t.name, t.position`,
    })
    yield* readInto(sql, sink, {
      what: 'the references to auth.users',
      path: SUPABASE_PATHS.authReferences,
      inner: sql`SELECT cl.relname AS "table", a.attname AS "column"
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace
        JOIN pg_class rt ON rt.oid = c.confrelid
        JOIN pg_namespace rn ON rn.oid = rt.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND n.nspname = 'public' AND rn.nspname = 'auth'
          AND rt.relname = 'users' AND array_length(c.conkey, 1) = 1`,
      order: sql`t."table", t."column"`,
    })
  })

/** One storage object the transaction listed. */
interface ListedObject {
  readonly bucket: string
  readonly path: string
}

/** The buckets, their objects and the storage policies; returns the objects. */
const fetchStorageTables = (
  sql: SQL,
  sink: SnapshotSink
): Effect.Effect<readonly ListedObject[], ImportFetchError> =>
  Effect.gen(function* () {
    yield* readInto(sql, sink, {
      what: 'the buckets',
      path: SUPABASE_PATHS.buckets,
      inner: sql`SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets`,
      order: sql`t.id`,
    })
    const objects = yield* readInto(sql, sink, {
      what: 'the storage objects',
      path: SUPABASE_PATHS.objects,
      inner: sql`SELECT bucket_id, name, metadata FROM storage.objects WHERE name IS NOT NULL`,
      order: sql`t.bucket_id, t.name`,
    })
    yield* readInto(sql, sink, {
      what: 'the storage policies',
      path: SUPABASE_PATHS.storagePolicies,
      inner: sql`SELECT tablename, policyname, cmd, roles::text[] AS roles
        FROM pg_policies WHERE schemaname = 'storage'`,
      order: sql`t.tablename, t.policyname`,
    })
    return objects.flatMap((object) => {
      const { bucket_id: bucket, name: path } = (object ?? {}) as Readonly<Record<string, unknown>>
      return typeof bucket === 'string' && typeof path === 'string' ? [{ bucket, path }] : []
    })
  })

const EXTENSION = /\.([A-Za-z0-9]{1,8})$/

/** Download one object's bytes into `assets/`, or record it as skipped. */
const downloadObject = (
  sink: SnapshotSink,
  storage: SupabaseStorageAccess | undefined,
  object: ListedObject
): Effect.Effect<void, ImportFetchError> => {
  const filename = object.path.slice(object.path.lastIndexOf('/') + 1)
  const source = `${object.bucket}/${object.path}`
  const skip = sink.attachment({ kind: 'skipped', source, filename })
  if (storage === undefined) return skip
  const encoded = [object.bucket, ...object.path.split('/')].map(encodeURIComponent).join('/')
  const credential = {
    origin: storage.origin,
    headers: { apikey: storage.serviceRoleKey, authorization: `Bearer ${storage.serviceRoleKey}` },
  }
  return downloadSourceAsset(
    `${storage.origin}/storage/v1/object/${encoded}`,
    storage.origin,
    credential
  ).pipe(
    Effect.flatMap((maybe) =>
      Option.match(maybe, {
        onNone: () => skip,
        onSome: (downloaded) =>
          sink
            .writeAsset(
              downloaded.sha256,
              EXTENSION.exec(filename)?.[1]?.toLowerCase() ?? '',
              downloaded.bytes
            )
            .pipe(
              Effect.flatMap((asset) =>
                sink.attachment({ kind: 'downloaded', source, filename, asset })
              )
            ),
      })
    )
  )
}

/** Fetch a Supabase project into the snapshot. */
export const fetchSupabaseProject = (
  url: string,
  context: SupabaseFetchContext
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.gen(function* () {
    const read = yield* Effect.scoped(
      Effect.gen(function* () {
        const sql = yield* acquireReadOnly(url)
        const ids = yield* fetchTablesAndRows(sql, context, { only: ['public'] })
        yield* fetchProjectTables(sql, context.sink)
        const objects = context.domains.includes('buckets')
          ? yield* fetchStorageTables(sql, context.sink)
          : []
        return { ids, objects }
      })
    )
    yield* Effect.forEach(
      read.objects,
      (object) => downloadObject(context.sink, context.storage, object),
      { discard: true }
    )
    return { ids: read.ids }
  }).pipe(Effect.withSpan('import.fetch-supabase-project'))
