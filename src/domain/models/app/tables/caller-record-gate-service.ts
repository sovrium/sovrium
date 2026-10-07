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
 * that table ({@link effectiveRolesOnTable}), then its row-level read rule for
 * that reader. How the reader is gathered differs by runtime (a page has the
 * session in hand, a use-case reads the account through its ports), so each
 * door builds it once per request; what it is, and what is decided from it,
 * does not differ.
 */

import { isGroupReference, toGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  type ReadAccessPlan,
  type ReadPrincipal,
  type TableLike,
} from './read-access-plan-service'
import { visitorRowRule, type VisitorRowRule } from './visitor-row-rule-service'
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
 *    may not read. An app with no `auth` block is the full-access model:
 *    `plan` is absent and every row is admitted.
 */
export type CallerTableGate =
  | { readonly kind: 'refused' }
  | {
      readonly kind: 'open'
      readonly plan: ReadAccessPlan | undefined
      readonly rule: Exclude<VisitorRowRule, { readonly kind: 'none' }>
    }

const OPEN_TO_ALL: CallerTableGate = { kind: 'open', plan: undefined, rule: { kind: 'all' } }

export const callerTableGate = (
  app: App,
  tableName: string,
  reader: CallerReader | undefined
): CallerTableGate => {
  if (!app.auth) return OPEN_TO_ALL
  const table = (app.tables ?? []).find((t) => t.name === tableName) as TableLike | undefined
  if (table === undefined) return { kind: 'refused' }
  const plan = buildReadAccessPlan({
    app,
    table,
    principal: tableReadPrincipal(table, reader),
    policy: CANONICAL_READ_POLICY,
  })
  if (!plan.allowed) return { kind: 'refused' }
  const rule = visitorRowRule(table, reader)
  return rule.kind === 'none' ? { kind: 'refused' } : { kind: 'open', plan, rule }
}

/**
 * Whether the gate admits `record`, the reader's assignments loaded for the
 * scope tables its rule reads. A gate that refused admits nothing.
 */
export const gateAdmitsRecord = (
  gate: CallerTableGate,
  record: RecordRow,
  assignments: ReadonlyMap<string, readonly string[]>
): boolean => {
  if (gate.kind === 'refused') return false
  return gate.rule.kind === 'all' || gate.rule.admits(record, assignments)
}
