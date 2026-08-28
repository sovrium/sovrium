/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Live implementation of `LinkRepository` — every Drizzle query against
 * `system.links`, and nothing else.
 *
 * Modelled on `user-view-repository-live.ts`, the canonical dual-dialect
 * system-table repository. The row ↔ record translation both directions depend
 * on lives in `link-row-codec.ts`, which documents the three departures from
 * that model (Drizzle-owned JSON codec, `Date` values never bound into raw SQL,
 * and `passwordHash` structurally absent from the returned record).
 *
 * Unique-index violations on `(app_name, slug) WHERE deleted_at IS NULL` become
 * `LinkSlugConflictError`; every other driver failure becomes `LinkDbError`.
 */

/* eslint-disable unicorn/no-null -- every nullable column and every port field is spelled `null`, not `undefined`: SQL has one absence marker and the port contract mirrors it, so `undefined` here would mean "leave alone" on a write and would silently drop the key on a read. */

import { and, desc, eq, inArray, isNotNull, isNull, notInArray } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  LinkDbError,
  LinkNotFoundError,
  LinkRepository,
  LinkSlugConflictError,
  type CreateLinkInput,
  type FindLinkInput,
  type LinkRecord,
  type LinkSource,
  type ListLinksInput,
  type SetLinkDisabledInput,
  type ShadowSweepInput,
  type UpdateLinkInput,
} from '@/application/ports/repositories/links/link-repository'
import { findConstraintViolation } from '@/domain/errors/driver-failure'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { links as linksPg } from '@/infrastructure/database/drizzle/schema/links'
import { links as linksSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/links'
import {
  createValues,
  overlayValues,
  toLinkRecord,
  updateAssignments,
} from '@/infrastructure/database/link-row-codec'
import type { DrizzleDB } from '@/infrastructure/database/drizzle/db'
import type { SQL } from 'drizzle-orm'

// Select the active dialect's table at module init. Importing the pg-core table
// directly 500s every query on SQLite: the client is built with the sqlite-core
// schema map, so the pg-core object resolves to a `system.links` name that does
// not exist there.
const links = resolveDialectSchema(linksPg, linksSqlite)

/** A unique-constraint violation on either dialect, by driver result code. */
const isUniqueViolation = (err: unknown): boolean => findConstraintViolation(err) === 'unique'

/** `WHERE` fragment scoping to one live row of one source. */
// eslint-disable-next-line functional/prefer-immutable-types -- Drizzle's `SQL` carries protected members, so `Readonly<SQL>` is not assignable back to the `.where()` parameter; the native mutable shape is the only one that composes. Same rationale as `systemTableRef` in admin-search-repository-live.ts.
const liveRowWhere = (appName: string, slug: string, source: LinkSource): SQL | undefined =>
  and(
    eq(links.appName, appName),
    eq(links.slug, slug),
    eq(links.source, source),
    isNull(links.deletedAt)
  )

/** List rows for the app, newest first. */
const listLinks = (
  db: Readonly<DrizzleDB>,
  input: Readonly<ListLinksInput>
): Effect.Effect<readonly LinkRecord[], LinkDbError> =>
  Effect.gen(function* () {
    const predicates = [
      eq(links.appName, input.appName),
      ...(input.includeArchived === true ? [] : [isNull(links.deletedAt)]),
      ...(input.source === undefined ? [] : [eq(links.source, input.source)]),
    ]
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(links)
          .where(and(...predicates))
          .orderBy(desc(links.createdAt)),
      catch: (cause) => new LinkDbError({ cause }),
    })
    return rows.map(toLinkRecord)
  })

/** Resolve one row by slug. */
const findLinkBySlug = (
  db: Readonly<DrizzleDB>,
  input: Readonly<FindLinkInput>
): Effect.Effect<LinkRecord | undefined, LinkDbError> =>
  Effect.gen(function* () {
    const predicates = [
      eq(links.appName, input.appName),
      eq(links.slug, input.slug),
      ...(input.includeArchived === true ? [] : [isNull(links.deletedAt)]),
      ...(input.source === undefined ? [] : [eq(links.source, input.source)]),
    ]
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(links)
          .where(and(...predicates))
          .orderBy(desc(links.createdAt))
          .limit(1),
      catch: (cause) => new LinkDbError({ cause }),
    })
    const row = rows[0]
    return row === undefined ? undefined : toLinkRecord(row)
  })

/** Insert a `source: 'db'` link; a live slug collision becomes a conflict. */
const createLink = (
  db: Readonly<DrizzleDB>,
  input: Readonly<CreateLinkInput>
): Effect.Effect<LinkRecord, LinkSlugConflictError | LinkDbError> =>
  Effect.gen(function* () {
    const values = createValues(input)
    const inserted = yield* Effect.tryPromise({
      try: () => db.insert(links).values(values).returning(),
      catch: (cause) =>
        isUniqueViolation(cause)
          ? new LinkSlugConflictError({ slug: input.slug })
          : new LinkDbError({ cause }),
    })
    const row = inserted[0]
    if (row === undefined) return yield* new LinkSlugConflictError({ slug: input.slug })
    return toLinkRecord(row)
  })

/** Patch a live `source: 'db'` link. */
const updateLink = (
  db: Readonly<DrizzleDB>,
  input: Readonly<UpdateLinkInput>
): Effect.Effect<LinkRecord, LinkNotFoundError | LinkDbError> =>
  Effect.gen(function* () {
    const updated = yield* Effect.tryPromise({
      try: () =>
        db
          .update(links)
          .set(updateAssignments(input))
          .where(liveRowWhere(input.appName, input.slug, 'db'))
          .returning(),
      catch: (cause) => new LinkDbError({ cause }),
    })
    const row = updated[0]
    if (row === undefined) return yield* new LinkNotFoundError({ slug: input.slug })
    return toLinkRecord(row)
  })

/**
 * Soft-delete a live `source: 'db'` link.
 *
 * `deleted_at` and `archived_at` are stamped together: the partial unique index
 * keys off the first and the catalog's archived filter off the second, and a row
 * that satisfied one but not the other would be re-mintable yet invisible.
 */
const archiveLink = (
  db: Readonly<DrizzleDB>,
  input: { readonly appName: string; readonly slug: string }
): Effect.Effect<LinkRecord, LinkNotFoundError | LinkDbError> =>
  Effect.gen(function* () {
    const now = new Date()
    const updated = yield* Effect.tryPromise({
      try: () =>
        db
          .update(links)
          .set({ deletedAt: now, archivedAt: now, updatedAt: now })
          .where(liveRowWhere(input.appName, input.slug, 'db'))
          .returning(),
      catch: (cause) => new LinkDbError({ cause }),
    })
    const row = updated[0]
    if (row === undefined) return yield* new LinkNotFoundError({ slug: input.slug })
    return toLinkRecord(row)
  })

/** Apply the overlay to an existing row of `source`; `undefined` when none. */
const applyOverlay = (
  db: Readonly<DrizzleDB>,
  input: Readonly<SetLinkDisabledInput>
): Effect.Effect<LinkRecord | undefined, LinkDbError> =>
  Effect.gen(function* () {
    const updated = yield* Effect.tryPromise({
      try: () =>
        db
          .update(links)
          .set({
            disabledAt: input.disabled ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(liveRowWhere(input.appName, input.slug, input.source))
          .returning(),
      catch: (cause) => new LinkDbError({ cause }),
    })
    const row = updated[0]
    return row === undefined ? undefined : toLinkRecord(row)
  })

/**
 * Create the overlay row for a config-declared slug.
 *
 * A concurrent creator loses the unique index and reports `undefined`, which the
 * caller resolves by re-applying the overlay to the winner's row.
 */
/** "The race was lost, no row to report" — a union member, not a throwaway void. */
const NO_OVERLAY_ROW: LinkRecord | undefined = undefined

const insertOverlay = (
  db: Readonly<DrizzleDB>,
  input: Readonly<SetLinkDisabledInput>
): Effect.Effect<LinkRecord | undefined, LinkDbError> => {
  const values = overlayValues({ ...input, now: new Date() })
  return Effect.tryPromise({
    try: () => db.insert(links).values(values).returning(),
    catch: (cause) =>
      isUniqueViolation(cause)
        ? new LinkSlugConflictError({ slug: input.slug })
        : new LinkDbError({ cause }),
  }).pipe(
    Effect.map((rows) => {
      const row = rows[0]
      return row === undefined ? undefined : toLinkRecord(row)
    }),
    // A lost insert race is not a failure — the caller re-applies the overlay to
    // whichever row won, so the operator's kill switch still lands.
    Effect.catchTag('LinkSlugConflictError', () => Effect.succeed(NO_OVERLAY_ROW))
  )
}

/** Set or lift the operator overlay, creating the config row on demand. */
const setLinkDisabled = (
  db: Readonly<DrizzleDB>,
  input: Readonly<SetLinkDisabledInput>
): Effect.Effect<LinkRecord, LinkNotFoundError | LinkDbError> =>
  Effect.gen(function* () {
    const updated = yield* applyOverlay(db, input)
    if (updated !== undefined) return updated
    if (input.source === 'db') return yield* new LinkNotFoundError({ slug: input.slug })

    const inserted = yield* insertOverlay(db, input)
    if (inserted !== undefined) return inserted

    const retried = yield* applyOverlay(db, input)
    if (retried !== undefined) return retried
    return yield* new LinkDbError({ cause: `Failed to upsert overlay row for '${input.slug}'` })
  })

/** Live `db` rows the config now claims and which are not yet stamped. */
const listShadowCandidates = (
  db: Readonly<DrizzleDB>,
  input: Readonly<ShadowSweepInput>
): Effect.Effect<readonly LinkRecord[], LinkDbError> =>
  Effect.gen(function* () {
    if (input.configSlugs.length === 0) return []
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(links)
          .where(
            and(
              eq(links.appName, input.appName),
              eq(links.source, 'db'),
              isNull(links.deletedAt),
              isNull(links.shadowedAt),
              inArray(links.slug, [...input.configSlugs])
            )
          ),
      catch: (cause) => new LinkDbError({ cause }),
    })
    return rows.map(toLinkRecord)
  })

/** Stamp `shadowed_at` on the named `db` rows. */
const markShadowed = (
  db: Readonly<DrizzleDB>,
  input: { readonly appName: string; readonly slugs: readonly string[] }
): Effect.Effect<number, LinkDbError> =>
  Effect.gen(function* () {
    if (input.slugs.length === 0) return 0
    const now = new Date()
    const updated = yield* Effect.tryPromise({
      try: () =>
        db
          .update(links)
          .set({ shadowedAt: now, updatedAt: now })
          .where(
            and(
              eq(links.appName, input.appName),
              eq(links.source, 'db'),
              isNull(links.deletedAt),
              isNull(links.shadowedAt),
              inArray(links.slug, [...input.slugs])
            )
          )
          .returning({ id: links.id }),
      catch: (cause) => new LinkDbError({ cause }),
    })
    return updated.length
  })

/** Clear `shadowed_at` on stamped `db` rows the config no longer declares. */
const clearShadowed = (
  db: Readonly<DrizzleDB>,
  input: Readonly<ShadowSweepInput>
): Effect.Effect<number, LinkDbError> =>
  Effect.gen(function* () {
    const stillClaimed =
      input.configSlugs.length === 0 ? [] : [notInArray(links.slug, [...input.configSlugs])]
    const updated = yield* Effect.tryPromise({
      try: () =>
        db
          .update(links)
          .set({ shadowedAt: null, updatedAt: new Date() })
          .where(
            and(
              eq(links.appName, input.appName),
              eq(links.source, 'db'),
              isNotNull(links.shadowedAt),
              ...stillClaimed
            )
          )
          .returning({ id: links.id }),
      catch: (cause) => new LinkDbError({ cause }),
    })
    return updated.length
  })

/**
 * Live `LinkRepository` — resolves the `Database` handle once, then closes over
 * it for every method.
 */
export const LinkRepositoryLive = Layer.effect(
  LinkRepository,
  Effect.gen(function* () {
    const db = yield* Database
    return LinkRepository.of({
      list: (input) => listLinks(db, input),
      findBySlug: (input) => findLinkBySlug(db, input),
      create: (input) => createLink(db, input),
      update: (input) => updateLink(db, input),
      archive: (input) => archiveLink(db, input),
      setDisabled: (input) => setLinkDisabled(db, input),
      listShadowCandidates: (input) => listShadowCandidates(db, input),
      markShadowed: (input) => markShadowed(db, input),
      clearShadowed: (input) => clearShadowed(db, input),
    })
  })
)

/* eslint-enable unicorn/no-null */
