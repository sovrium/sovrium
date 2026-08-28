/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * LinkRepository port — data-access contract for `system.links`.
 *
 * Backs the DB half of the admin links catalog. The catalog itself is a UNION of
 * two populations and this port only ever sees one of them: config-declared
 * links (`app.links[]`) are resolved from memory and are NOT rows here. A row
 * exists for a link minted at runtime (`source: 'db'`), or as a lazily-created
 * overlay carrying `disabled_at` for a config-declared slug (`source: 'config'`)
 * — see the table's own doc comment.
 *
 * Three shapes are deliberate:
 *
 * - **`LinkRecord` carries no `passwordHash`.** [internal ref] D5 forbids the hash from
 *    reaching the console payload, and the cheapest way to keep a promise like
 *    that is to make it structurally impossible: a field the port never returns
 *    cannot be spread into a response by a future handler that forgot.
 *
 *  - **Every timestamp is an ISO 8601 string, not a `Date`.** The two dialects
 *    hand back different runtime representations (`timestamp with time zone` vs
 *    a `timestamp_ms` integer), and normalising once at this boundary is what
 *    stops each consumer from re-deriving the coercion — and getting it subtly
 *    different on SQLite.
 *
 *  - **No `state`.** Operational state is DERIVED, by the same
 *    `resolveLinkState` the redirect handler uses, and it depends on a click
 *    count this port has no business reading. A repository that returned a state
 *    would be a second decision function.
 *
 * @see src/infrastructure/database/drizzle/schema/links.ts — the table
 * @see src/domain/utils/matching/link-resolver.ts — the single state decision
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/** Where a link's definition comes from. Mirrors the `source` column. */
export type LinkSource = 'config' | 'db'

/** One candidate destination as stored in the `targets` JSON column. */
export interface LinkTargetRecord {
  readonly to: string
  readonly weight?: number | undefined
}

/** Campaign parameters as stored in the `utm` JSON column. */
export interface LinkUtmRecord {
  readonly source?: string | undefined
  readonly medium?: string | undefined
  readonly campaign?: string | undefined
  readonly content?: string | undefined
  readonly term?: string | undefined
}

/**
 * A `system.links` row, normalised.
 *
 * `destination` and `targets` are mutually exclusive the same way `to` and
 * `targets` are in config: a single-destination link stores `destination`, a
 * rotation stores `targets`. Consumers unwrap both through `linkTargets()`
 * rather than branching locally.
 */
export interface LinkRecord {
  readonly id: string
  readonly appName: string
  readonly slug: string
  readonly source: LinkSource
  readonly destination: string | null
  readonly targets: readonly LinkTargetRecord[] | null
  readonly title: string | null
  readonly tags: readonly string[]
  readonly notes: string | null
  readonly enabled: boolean
  readonly validFrom: string | null
  readonly validUntil: string | null
  readonly maxClicks: number | null
  readonly expiredTo: string | null
  readonly utm: LinkUtmRecord | null
  /** The operator overlay. Non-null means the console switched this link off. */
  readonly disabledAt: string | null
  /** Stamped by the boot sweep when `app.links[]` later claims this slug. */
  readonly shadowedAt: string | null
  readonly archivedAt: string | null
  readonly createdBy: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly deletedAt: string | null
}

/**
 * Listing payload.
 *
 * Deliberately NARROW: only the two predicates a SQL query can answer better
 * than memory. `q`, `tag` and `state` are union-wide concerns — they must apply
 * across config-declared links too — so filtering them here would produce a page
 * that is correct for half the catalog and wrong for the other half.
 */
export interface ListLinksInput {
  readonly appName: string
  /** Include soft-deleted rows. Default false. */
  readonly includeArchived?: boolean | undefined
  /** Narrow to one population. Omit to get overlay rows alongside db links. */
  readonly source?: LinkSource | undefined
}

/** Lookup payload for `findBySlug`. */
export interface FindLinkInput {
  readonly appName: string
  readonly slug: string
  /** Include a soft-deleted row instead of reporting it absent. Default false. */
  readonly includeArchived?: boolean | undefined
  /**
   * Narrow to one population.
   *
   * Load-bearing rather than convenient: a shadowed `db` row and a `config`
   * overlay row can hold the SAME slug (the partial unique index is on
   * `(app_name, slug)`, so only one of them may be live — but a soft-deleted
   * third is possible too). Without this, the overlay handler could patch the
   * shadowed definition instead of the operator's kill switch.
   */
  readonly source?: LinkSource | undefined
}

/**
 * Insert payload.
 *
 * Post-validation: the route has already run `createLinkRequestSchema`, so the
 * slug charset and the field bounds are somebody else's problem by the time a
 * value reaches here.
 */
export interface CreateLinkInput {
  readonly appName: string
  readonly slug: string
  /**
   * The two destination forms, exactly one of which is set — the same rule the
   * config schema applies to `to` / `targets`, so a console-minted link is the
   * same shape as a config-declared one and the resolver needs no branch.
   *
   * `linkTargets()` normalises the single form into a one-element list, which is
   * why `targetIndex` is recorded on a plain link's clicks too: turning it into
   * an experiment later does not restart its history from zero.
   */
  readonly destination?: string | undefined
  readonly targets?: readonly LinkTargetRecord[] | undefined
  readonly enabled?: boolean | undefined
  readonly title?: string | null | undefined
  readonly tags?: readonly string[] | undefined
  readonly notes?: string | null | undefined
  readonly validFrom?: string | null | undefined
  readonly validUntil?: string | null | undefined
  readonly maxClicks?: number | null | undefined
  readonly expiredTo?: string | null | undefined
  readonly utm?: LinkUtmRecord | null | undefined
  readonly createdBy?: string | null | undefined
}

/**
 * Sparse update payload.
 *
 * ABSENT and `null` mean different things and the distinction is load-bearing:
 * absent leaves the column alone, `null` clears it. Collapsing them would make
 * an expiry impossible to remove once set — precisely the edit an operator makes
 * when a campaign is extended.
 *
 * There is no `slug`: a rename would break every share of the old address and
 * orphan the click history, which is keyed on the slug.
 */
export interface UpdateLinkInput {
  readonly appName: string
  readonly slug: string
  /**
   * Either destination form REPLACES the other, per the update contract. The
   * repository therefore clears the counterpart column rather than leaving it —
   * a row carrying both would resolve through `targets` while the catalog row
   * reported `destination`, and the console would disagree with the redirect.
   */
  readonly destination?: string | undefined
  readonly targets?: readonly LinkTargetRecord[] | undefined
  readonly enabled?: boolean | undefined
  readonly title?: string | null | undefined
  readonly tags?: readonly string[] | undefined
  readonly notes?: string | null | undefined
  readonly validFrom?: string | null | undefined
  readonly validUntil?: string | null | undefined
  readonly maxClicks?: number | null | undefined
  readonly expiredTo?: string | null | undefined
  readonly utm?: LinkUtmRecord | null | undefined
}

/**
 * Overlay payload for `setDisabled`.
 *
 * `source` decides whether a missing row is an error or an instruction: for a
 * `db` link the row must already exist, while for a `config`-declared slug the
 * overlay row is created on demand — the file has no place to record an
 * operator's 03:00 kill switch, so the database has to.
 */
export interface SetLinkDisabledInput {
  readonly appName: string
  readonly slug: string
  readonly source: LinkSource
  /** True to switch the link off, false to lift the console's own overlay. */
  readonly disabled: boolean
  readonly actorId?: string | null | undefined
}

/** Payload for the boot shadow sweep. */
export interface ShadowSweepInput {
  readonly appName: string
  /** Every slug the decoded config currently declares. */
  readonly configSlugs: readonly string[]
}

/** No live row for that slug (404 surface for a `db` link). */
export class LinkNotFoundError extends Data.TaggedError('LinkNotFoundError')<{
  readonly slug: string
}> {}

/**
 * Unique-index violation on `(app_name, slug) WHERE deleted_at IS NULL` —
 * translated to HTTP 409 `LINK_SLUG_TAKEN` by the route handler.
 */
export class LinkSlugConflictError extends Data.TaggedError('LinkSlugConflictError')<{
  readonly slug: string
}> {}

/** Catch-all infrastructure failure. Route handler maps it to HTTP 500. */
export class LinkDbError extends Data.TaggedError('LinkDbError')<{
  readonly cause: unknown
}> {}

/**
 * LinkRepository port.
 *
 * Every operation is app-scoped (`appName`), because the slug unique index is —
 * a query that forgot the scope would resolve another app's link and answer 200.
 */
export class LinkRepository extends Context.Service<
  LinkRepository,
  {
    /**
     * Every row for the app, newest first. Soft-deleted rows are excluded
     * unless `includeArchived` is set, and `source: 'config'` overlay rows are
     * returned alongside `db` links unless a `source` narrowing asks otherwise.
     */
    readonly list: (input: ListLinksInput) => Effect.Effect<readonly LinkRecord[], LinkDbError>

    /** Resolve one row by slug. Absent (or soft-deleted) reports `undefined`. */
    readonly findBySlug: (
      input: FindLinkInput
    ) => Effect.Effect<LinkRecord | undefined, LinkDbError>

    /**
     * Insert a `source: 'db'` link. A live row already holding the slug surfaces
     * as `LinkSlugConflictError`; a soft-deleted one does not, because the
     * unique index is partial on `deleted_at IS NULL` so a retired name is
     * re-mintable.
     */
    readonly create: (
      input: CreateLinkInput
    ) => Effect.Effect<LinkRecord, LinkSlugConflictError | LinkDbError>

    /**
     * Patch a live `source: 'db'` link. A missing row surfaces as
     * `LinkNotFoundError` — the route decides whether that becomes a 404 or the
     * 409 a config-declared slug earns.
     */
    readonly update: (
      input: UpdateLinkInput
    ) => Effect.Effect<LinkRecord, LinkNotFoundError | LinkDbError>

    /**
     * Soft-delete: stamps `deleted_at` AND `archived_at` together, so the
     * catalog's archived filter and the partial unique index agree about which
     * rows are retired.
     */
    readonly archive: (input: {
      readonly appName: string
      readonly slug: string
    }) => Effect.Effect<LinkRecord, LinkNotFoundError | LinkDbError>

    /**
     * Set or lift the operator overlay. For a `config` source the overlay row is
     * created if absent; for a `db` source a missing row is a
     * `LinkNotFoundError`.
     */
    readonly setDisabled: (
      input: SetLinkDisabledInput
    ) => Effect.Effect<LinkRecord, LinkNotFoundError | LinkDbError>

    /**
     * Live `source: 'db'` rows whose slug the config now claims and which are
     * not yet stamped — the boot sweep's work list.
     */
    readonly listShadowCandidates: (
      input: ShadowSweepInput
    ) => Effect.Effect<readonly LinkRecord[], LinkDbError>

    /** Stamp `shadowed_at` on the named `db` rows. Returns how many were stamped. */
    readonly markShadowed: (input: {
      readonly appName: string
      readonly slugs: readonly string[]
    }) => Effect.Effect<number, LinkDbError>

    /**
     * Clear `shadowed_at` on every stamped `db` row whose slug the config no
     * longer declares. Un-shadowing is the natural inverse of the stamp, which
     * is why the column is nullable rather than a status enum.
     */
    readonly clearShadowed: (input: ShadowSweepInput) => Effect.Effect<number, LinkDbError>
  }
>()('LinkRepository') {}
