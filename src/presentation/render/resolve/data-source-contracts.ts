/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The vocabulary every stage of data-source resolution shares: the two outcome
 * symbols, the result union, the injected database port, the error stamp, the
 * field validator, and the `{ systemSource }` desugaring that normalises a
 * named catalog reference into the inline form every downstream branch reads.
 *
 * A contracts module rather than a `types.ts`: `withDataSourceError`,
 * `validateDataSourceFields` and `desugarSystemSourceRef` are behaviour, but
 * behaviour that belongs to the SHAPE rather than to any one stage — each is
 * called from two or more of the four stages next door, and none of them
 * depends on any of the others.
 */

import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { resolveSystemSource } from '@/domain/models/app/system-sources'
import type { ReadReadPosition } from '@/application/ports/repositories/tables/read-state-repository'
import type { LookupReadMask } from '@/application/ports/repositories/tables/table-repository'
import type {
  LoadRowRuleContext,
  ReadQueryMasks,
  ReadReaderRows,
  ReadRecordLabels,
  ReadTableAsCaller,
  SignFileUrl,
} from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { ViewerIdentity } from '@/domain/models/app/pages/component-session-visibility-service'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { InvitationFacts } from '@/domain/models/app/pages/invitation-vars-service'
import type { CallerFieldReader } from '@/domain/models/app/tables/field-read-filter-service'
import type { RecordTextContext } from '@/presentation/render/props/record-value-format'

/** The lookups and counts a read steers on as the reader's records list does (`ReadQueryMasks`). */
export type QueryLookupMasks = readonly LookupReadMask[]

export const SINGLE_RECORD_NOT_FOUND = Symbol('SINGLE_RECORD_NOT_FOUND')
export const UNAUTHORIZED = Symbol('UNAUTHORIZED')

export type DataSourceSectionResult =
  | Component
  | SimpleComponentReference
  | ComponentReference
  | typeof SINGLE_RECORD_NOT_FOUND
  | typeof UNAUTHORIZED

/**
 * Database access interface for data source resolution.
 *
 * Injected by the caller to keep the presentation layer free of
 * direct infrastructure/database dependencies. The live implementation
 * is provided by DataSourceRepositoryLive in the infrastructure layer.
 */
export interface DataSourceDb {
  readonly fetchRecords: (
    tableName: string,
    options?: {
      readonly fields?: readonly string[]
      readonly filter?: readonly DataFilter[]
      readonly sort?: readonly DataSort[]
      readonly pageSize?: number
      readonly page?: number
      readonly liveOnly?: boolean
      readonly lookupMasks?: QueryLookupMasks
    }
  ) => Promise<readonly Record<string, unknown>[]>

  readonly countRecords: (
    tableName: string,
    filter?: readonly DataFilter[],
    options?: { readonly liveOnly?: boolean; readonly lookupMasks?: QueryLookupMasks }
  ) => Promise<number>

  readonly fetchSingleRecord: (
    tableName: string,
    paramField: string,
    paramValue: string,
    fields?: readonly string[],
    /** As the repository port's: `liveOnly`, and `paramLanguage` for a translatable `paramField`. */
    options?: { readonly liveOnly?: boolean; readonly paramLanguage?: string }
    // eslint-disable-next-line max-params -- positional signature kept for its existing callers; `options` is an optional fifth argument
  ) => Promise<Record<string, unknown> | undefined>

  /**
   * Optional — the ids one record links through each given many-to-many field,
   * read from their junction tables (`fieldName -> relatedIds`). A single-record
   * form reads them to open with its links; absent, it opens with none.
   */
  readonly fetchManyToManyLinks?: (
    tableName: string,
    recordId: string,
    fields: readonly {
      readonly fieldName: string
      readonly relatedTable: string
      readonly linkTable: string
    }[]
  ) => Promise<Readonly<Record<string, readonly (string | number)[]>>>

  /**
   * Reads the user's accessible record-ids from `user_access` for one scope
   * table. Mandatory: `$currentUser.assignments.<table>` and
   * `$currentUser.activeAssignment` both resolve into data filters, and this
   * reader is what validates them against real access. When it was optional,
   * every consumer had to carry a "cannot validate" branch that trusted the
   * caller-supplied cookie verbatim — a tampered cookie could then scope a
   * user to data they cannot reach. Adapters with nothing to read supply a
   * reader returning `[]`, which fails closed. With `role`, only the rows
   * granted under that role count.
   */
  readonly fetchUserAssignments: (
    userId: string,
    tableSlug: string,
    role?: string
  ) => Promise<readonly string[]>

  /**
   * Optional — fetch every distinct `role` value the user holds across all
   * `system.user_access` rows (any scope-table). Used by `renderPageByPath`
   * to overlay these onto the Better Auth `session.role` into
   * `session.effectiveRoles` so a user whose Better Auth role is `member`
   * but who holds `role: 'engineer'` in `user_access` passes a page guard
   * of `access: ['engineer']`. Mirrors the table-level Z-3 overlay.
   *
   * [internal ref].
   */
  readonly fetchUserAccessRoles?: (userId: string) => Promise<readonly string[]>

  /**
   * Optional — the accounts a `user` picker offers a signed-in visitor, each
   * with its label (name, else its masked email), ordered by label, at most `limit`.
   * Absent, an embedded form's user picker offers no account.
   */
  readonly fetchAccountChoices?: (
    limit: number
  ) => Promise<ReadonlyArray<{ readonly id: string; readonly label: string }>>

  /**
   * Optional — a table as one caller may see it: the views the table API lists
   * her and the permission map it answers her, from the API's own programs.
   * Folded in by the renderer layer from the route's request context, which a
   * static build passes through too (as the anonymous visitor). Absent — the
   * operator console's mounted surfaces, a unit test — a grid's payload is not
   * narrowed to its reader.
   */
  readonly readTableAsCaller?: ReadTableAsCaller

  /**
   * Optional — the role and groups of a caller the page renders without a
   * session for: a mounted operator console's. Read by the record sheet's field
   * access alone, so a field the records API answers her is in her sheet.
   */
  readonly callerFieldReader?: CallerFieldReader

  /** Optional — that mounted caller's id and email, for a `$user.id` / `$user.email` condition only. */
  readonly viewerIdentity?: ViewerIdentity

  /**
   * Optional — the labels of the record a page is bound to, as the records API
   * answers its reader (`_display`). Absent, a `user` or relationship field of
   * that record reads as its stored id.
   */
  readonly readRecordLabels?: ReadRecordLabels

  /**
   * Optional — the reader's position on one parent record of a `readState`
   * relationship, as the mark-read route keeps it. Absent, a conversation
   * bound to that parent's children draws no New marker.
   */
  readonly readReadPosition?: ReadReadPosition

  /**
   * Optional — the context a table's row-level rule judges a reader by, as the
   * records API loads it (her assignments, and the ids each `contains` or
   * relationship leaf admits), once per request and table. Absent, a page
   * judges a row by the reader's assignments alone, and such a leaf admits no row.
   */
  readonly loadRowRuleContext?: LoadRowRuleContext

  /**
   * The rows of a table the records list admits the page's reader, with the
   * grants behind them. Required, so every server-drawn read — a list, a feed,
   * a sitemap — is narrowed to them: the route folds in its request's own
   * reader, and a render with none answers as a visitor who is not signed in
   * (`signedOutReaderRows`).
   */
  readonly readReaderRows: ReadReaderRows

  /**
   * Optional — the records list's masks of the lookups and counts a query
   * names, for the page's reader: a list filtered or sorted on a count she
   * reads narrowed steers on it as her records list does. Absent (a feed, a
   * mounted console, a unit test), every column is read as stored.
   */
  readonly readQueryMasks?: ReadQueryMasks

  /** Optional — the request's download-address signer (`file-preview`). Absent, no preview is drawn. */
  readonly signFileUrl?: SignFileUrl

  /**
   * Optional — the invitation an invitation token names, for a
   * `page.invitation` page. `undefined` for a token that matches nothing (or an
   * accepted or revoked invitation). Absent, every token reads as invalid.
   */
  readonly readInvitation?: (token: string) => Promise<InvitationFacts | undefined>

  /**
   * Optional — the two-step sign-in the request's cookies carry, for a page
   * holding a `verifyTwoFactor` form: whether one waits for its code, and where
   * it was headed. Absent, a code form draws its field as it always did.
   */
  readonly readTwoFactorAttempt?: (
    cookies: Readonly<Record<string, string>> | undefined
  ) => Promise<{ readonly live: boolean; readonly destination?: string }>

  /**
   * Optional — the page this render serves: its language and the app's tables,
   * so a `$record.<field>` in page text prints a date or an amount formatted by
   * its field type. Absent, every value prints as stored.
   */
  readonly recordText?: RecordTextContext

  /**
   * Optional — the link-preview cards the server has already read for these
   * normalised addresses, in their order. Reads nothing from another site: a
   * page is read when a record holding it is stored. Absent, no card is drawn.
   */
  readonly readLinkPreviews?: (
    addresses: readonly string[]
  ) => Promise<readonly LinkPreviewCardFacts[]>

  /**
   * Optional — the reply summary of each record of a table: its approved
   * comments' count, the names of the last three people who replied and when
   * the last reply came. What every reader of the record sees in its thread,
   * so it is read for rows the read gate already admitted. Absent, a turn's
   * `replies` draws nothing.
   */
  readonly readCommentSummaries?: (
    table: { readonly id?: number | string | undefined; readonly name: string },
    recordIds: readonly string[]
  ) => Promise<ReadonlyMap<string, CommentSummaryFacts>>
}

/** The reply summary of one record. */
export interface CommentSummaryFacts {
  readonly count: number
  /** The last people who replied, most recent first, each once, at most three. */
  readonly lastRepliers: readonly string[]
  readonly lastAt: string
}

/** One link-preview card as the server read it: text fields only. */
export interface LinkPreviewCardFacts {
  readonly id: string
  readonly url: string
  readonly title: string | undefined
  readonly description: string | undefined
  readonly siteName: string | undefined
  /** True when the page's picture is kept and served by the app. */
  readonly hasImage: boolean
}

/** Injects a _dataSourceError prop into a component's props. */
export function withDataSourceError(component: Component, errorMessage: string): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      _dataSourceError: errorMessage,
    },
  }
}

/** Validates dataSource fields against a table's field definitions. */
export function validateDataSourceFields(
  component: Component,
  tableName: string,
  requestedFields: readonly string[],
  tableFieldNames: Set<string>
): Component | undefined {
  const missingFields = requestedFields.filter((f) => !tableFieldNames.has(f))
  if (missingFields.length === 0) return undefined
  return withDataSourceError(
    component,
    `Error: fields not found in table "${tableName}": ${missingFields.join(', ')}`
  )
}

/**
 * Replaces `$record.fieldName` placeholders with actual field values from a
 * record — re-exported from the ONE implementation in
 * `@/domain/utils/substitute-record-vars`.
 *
 * No local copy: a copy testing `value !== undefined` only would paint an
 * explicit `null` as the literal text `null` into whatever it was substituted
 * into. See the shared module's header for the coercion contract and the `|`
 * fallback chain, both of which every caller of this name gets.
 */
export { substituteRecordVars }

/**
 * Desugar the `{ systemSource: <name> }` named-catalog shorthand (CAP-4) into the
 * inline `{ system: <entry> }` form by resolving the name against
 * `app.systemSources`. The resolved catalog entry (minus its `name`) is a drop-in
 * for the inline system binding, so AFTER desugaring the component is identical to
 * one authored with `dataSource: { system: { endpoint, ... } }` — every downstream
 * branch (island short-circuits + the data-table island fetch hooks) sees only
 * `dataSource.system` and needs no `{ systemSource }` awareness, and the catalog
 * never reaches the client bundle. A reference that does not resolve (catalog-less
 * app) is left unchanged: decode-time `validateAllSystemSourceReferences` already
 * rejects an undeclared reference before boot.
 */
export function desugarSystemSourceRef(component: Component, app: App): Component {
  const dataSource = component.dataSource as { readonly systemSource?: unknown } | undefined
  const ref = dataSource?.systemSource
  if (typeof ref !== 'string') return component
  const entry = resolveSystemSource(ref, app.systemSources)
  if (!entry) return component
  const { name: _name, ...system } = entry
  return { ...component, dataSource: { system } as Component['dataSource'] }
}
