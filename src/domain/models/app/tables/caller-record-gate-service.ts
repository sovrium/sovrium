/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE caller-record gate: may this reader read rows of this table, and which?
 *
 * A record reaches a person through several doors — the records API, a page
 * that draws it, a hosted form that names it as the record its page showed —
 * and if each assembled the reader on its own, from whatever it happened to
 * have (the page from the full session, the hosted form from an id and a role,
 * the records API from a session with no email), each assembly would answer a
 * different question, with access defects in both directions: the app's top
 * role refused a record its page showed it, a rule naming the reader's email
 * refusing her own rows and serving blank ones, and a role a `user_access`
 * assignment gives opening, on a page, tables the records API keeps shut.
 *
 * So the reader is ONE shape — {@link CallerReader}, everything a read decision
 * reads about a person — and the decision is ONE function over it,
 * {@link callerTableGate}: the table's read grant over the roles that count on
 * that table ({@link effectiveRolesOnTable}) — judged by the one table-level
 * read verdict every door asks ({@link judgeTableReadGrant}) — then its
 * row-level read rule for that reader. How the reader is gathered differs by runtime (a page has the
 * session in hand, a use-case reads the account through its ports), so each
 * door builds it once per request; what it is, and what is decided from it,
 * does not differ.
 */

import {
  anonymousGrant,
  servesNoAuthVisitor,
} from '@/domain/models/app/auth/anonymous-grant-service'
import { isGroupReference, toGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  judgeTableReadGrant,
  type ReadGrantTable,
} from '@/domain/models/app/auth/table-read-grant-service'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  fullAccessReadPlan,
  type ReadAccessPlan,
  type ReadPrincipal,
  type TableLike,
} from './read-access-plan-service'
import { visitorRowRule, type VisitorRowRule } from './visitor-row-rule-service'
import { isWriteOnlyField } from './write-only-field-service'
import type { CurrentUserContext } from './row-level-evaluator-service'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

type RecordRow = Readonly<Record<string, unknown>>

/** Everything a read decision reads about one signed-in person. */
export interface CallerReader {
  readonly userId: string
  /** The account role. */
  readonly role: string
  /** The address `$currentUser.email` resolves to; absent when the account has none. */
  readonly email?: string | undefined
  /** The groups she belongs to, un-prefixed. */
  readonly groups: readonly string[]
  /** Every role her `user_access` assignments give her — counted only where rules govern rows. */
  readonly accessRoles: readonly string[]
  /** The app's top role (or the built-in `admin`): reads every row a rule would scope. */
  readonly isUnrestricted: boolean
}

/**
 * The roles one table's grant is asked about for a caller: her account role
 * (first), a `group:<name>` entry per group, and — on a table that declares
 * `rowLevelPermissions`, and only there — the roles her assignments give her.
 * The records API's own set: an assignment opens the rows its rule picks, and
 * on a table with no rule there is nothing for it to pick.
 */
export const effectiveRolesOnTable = (
  table: Readonly<{ rowLevelPermissions?: unknown }> | undefined,
  caller: Readonly<{
    role: string
    groups: readonly string[]
    accessRoles?: readonly string[] | undefined
  }>
): readonly string[] => {
  const overlay = table?.rowLevelPermissions === undefined ? [] : (caller.accessRoles ?? [])
  return [...new Set([caller.role, ...caller.groups.map(toGroupReference), ...overlay])]
}

/**
 * The reader a server-rendered page holds: its session, as the request
 * hydrated it. The page's `user_access` overlay (`effectiveRoles`, which its
 * own `access` guard reads) is the account role plus the assignment roles, so
 * those are the entries that are neither the account role nor a group.
 */
export const callerReaderFromSession = (
  session: SessionInfo | undefined,
  app: Pick<App, 'auth'>
): CallerReader | undefined =>
  session === undefined
    ? undefined
    : {
        userId: session.userId,
        role: session.role,
        email: session.email,
        groups: session.groups ?? [],
        accessRoles: (session.effectiveRoles ?? []).filter(
          (entry) => entry !== session.role && !isGroupReference(entry)
        ),
        isUnrestricted: isAdminEquivalent(session.role, app),
      }

/** The principal a table's read plan is built for, the reader's roles counted as on that table. */
export const tableReadPrincipal = (
  table: Readonly<{ rowLevelPermissions?: unknown }> | undefined,
  reader: CallerReader | undefined
): ReadPrincipal =>
  reader === undefined
    ? { role: '', effectiveRoles: [''], isAuthenticated: false }
    : {
        role: reader.role,
        effectiveRoles: effectiveRolesOnTable(table, reader),
        isAuthenticated: true,
      }

/**
 * One table's read gates for one reader, asked before any row of it is read:
 *
 *  - `refused` — she may read no row of it: the read grant refuses her, it is
 *    not a declared table, or its rule names the signed-in person and she is
 *    not signed in;
 *  - `open` — `rule` says whether a row is hers (`all` admits every row; a
 *    `check` is asked with her assignments), and `plan` names the columns she
 *    may not read. An app with no `auth` block refuses a table that does not
 *    open `read` to everyone (`anonymousGrant`); a table that does is the
 *    full-access model: every row is admitted, and `plan` withholds only the
 *    write-only columns ({@link fullAccessReadPlan}) — absent for a table it
 *    does not declare.
 */
export type CallerTableGate =
  | { readonly kind: 'refused' }
  | {
      readonly kind: 'open'
      readonly plan: ReadAccessPlan | undefined
      readonly rule: Exclude<VisitorRowRule, { readonly kind: 'none' }>
    }

export const callerTableGate = (
  app: App,
  tableName: string,
  reader: CallerReader | undefined
): CallerTableGate => {
  const table = (app.tables ?? []).find((t) => t.name === tableName) as TableLike | undefined
  if (!app.auth) {
    // A visitor holds only the tables that open `read` to everyone.
    if (table !== undefined && servesNoAuthVisitor(app) && !anonymousGrant(table, 'read', app)) {
      return { kind: 'refused' }
    }
    const plan = table === undefined ? undefined : fullAccessReadPlan(app, table)
    return { kind: 'open', plan, rule: { kind: 'all' } }
  }
  if (table === undefined) return { kind: 'refused' }
  const principal = tableReadPrincipal(table, reader)
  const caller = { effectiveRoles: principal.effectiveRoles, signedOut: !principal.isAuthenticated }
  if (judgeTableReadGrant(table as ReadGrantTable, caller, app)._tag !== 'Allowed') {
    return { kind: 'refused' }
  }
  const plan = buildReadAccessPlan({ app, table, principal, policy: CANONICAL_READ_POLICY })
  const rule = visitorRowRule(table, reader)
  return rule.kind === 'none' ? { kind: 'refused' } : { kind: 'open', plan, rule }
}

/**
 * May the visitor of an app with no `auth` block read `tableName`? Only a table
 * that opens `read` to everyone ({@link callerTableGate}); a name the app does
 * not declare, and the operator console mounted into an app, are not refused.
 * Asked only of an app with no `auth` block.
 */
export const noAuthTableOpen = (app: App, tableName: string): boolean =>
  callerTableGate(app, tableName, undefined).kind === 'open'

/** {@link noAuthTableOpen}, and none of `fields` of it a write-only column, which no one reads. */
export const noAuthColumnsReadable = (
  app: App,
  tableName: string,
  fields: readonly string[]
): boolean =>
  noAuthTableOpen(app, tableName) && fields.every((f) => !isWriteOnlyField(app, tableName, f))

/**
 * The read plan of an app with no `auth` block for `table`: refused to its
 * visitor when the table does not open `read` to everyone, else the
 * full-access model ({@link fullAccessReadPlan}); `undefined` for a table the
 * app does not declare.
 */
export const noAuthReadPlan = (
  app: App,
  table: TableLike | undefined
): ReadAccessPlan | undefined => {
  if (table === undefined) return undefined
  if (noAuthTableOpen(app, table.name)) return fullAccessReadPlan(app, table)
  const principal = tableReadPrincipal(table, undefined)
  return buildReadAccessPlan({ app, table, principal, policy: CANONICAL_READ_POLICY })
}

/**
 * Whether the gate admits `record`, judged against the reader's loaded context
 * (`loadCurrentUserContext`). A gate that refused admits nothing.
 */
export const gateAdmitsRecord = (
  gate: CallerTableGate,
  record: RecordRow,
  context: CurrentUserContext
): boolean => {
  if (gate.kind === 'refused') return false
  return gate.rule.kind === 'all' || gate.rule.admits(record, context)
}
