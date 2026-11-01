/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Row-level security as `permissions` and `rowLevelPermissions`, through a
 * CLOSED translation table: what the table does not recognise stays closed.
 *
 * | Policy                                                        | Sovrium                          |
 * | ------------------------------------------------------------- | -------------------------------- |
 * | `true`, `TO anon` or `TO public`                              | open to `all`                    |
 * | `true` `TO authenticated`; any role, `auth.role() = 'authenticated'` | open to `authenticated`   |
 * | `auth.uid() = <col>`, `<col> = auth.uid()`, `(select auth.uid()) = <col>`, `<col>` a `user` field, `TO authenticated` or `TO public` | `authenticated` + a row rule `<col> eq $currentUser.id` |
 * | anything else, a RESTRICTIVE policy, a custom role            | unmapped: the operation `[admin]` |
 *
 * `SELECT`, `INSERT`, `UPDATE`, `DELETE` become `read`, `create`, `update` (row
 * rule key `write`) and `delete`; `ALL` covers the four. A policy's expression is
 * `USING` for read, update and delete and `WITH CHECK` for create; an update
 * policy maps only when both its expressions map to the same thing. Several
 * mapped permissive policies on one operation under one grant join their row
 * rules with `or`, and one with no row rule makes the operation unconditional.
 * An operation no policy covers is closed, as Supabase closes it, and so is
 * every operation of a table whose row-level security was off.
 *
 * The expressions are read in the form `pg_policies` deparses them:
 * `(( SELECT auth.uid() AS uid) = owner_id)`, `(auth.role() = 'authenticated'::text)`.
 */

import type { CanonicalTable } from './canonical-base'
import type { ConfigEntry } from './field-settings-service'
import type { ImportReport } from './import-report'
import type { MappedTable, TablePlan } from './table-mapper-service'

type Policy = NonNullable<CanonicalTable['rowSecurity']>['policies'][number]
type Section = NonNullable<ImportReport['permissions']>
type TableSection = Section['tables'][number]
type Todo = ImportReport['todo'][number]

/** Who a translated operation is open to. */
export type PolicyGrant = 'all' | 'authenticated'

/** What one policy, or one expression, translates to. */
export interface PolicyTranslation {
  readonly grant: PolicyGrant
  /** The owner column a row rule compares with the signed-in person. */
  readonly owner?: string
}

/** What an expression says, before its roles are weighed. */
type Term =
  | { readonly kind: 'true' }
  | { readonly kind: 'authenticated' }
  | { readonly kind: 'owner'; readonly column: string }

/** The index of the parenthesis closing the one at 0, or -1. */
const closingOf = (expression: string): number => {
  const step = (index: number, depth: number): number => {
    if (index >= expression.length) return -1
    const next = depth + (expression[index] === '(' ? 1 : expression[index] === ')' ? -1 : 0)
    return next === 0 ? index : step(index + 1, next)
  }
  return step(0, 0)
}

/** An expression without the parentheses that wrap all of it. */
const unwrapped = (expression: string): string => {
  const trimmed = expression.trim()
  return trimmed.startsWith('(') && closingOf(trimmed) === trimmed.length - 1
    ? unwrapped(trimmed.slice(1, -1))
    : trimmed
}

const UID = String.raw`(?:auth\.uid\(\)|\(\s*select\s+auth\.uid\(\)(?:\s+as\s+uid)?\s*\))`
const COLUMN = String.raw`(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))`
const UID_FIRST = new RegExp(String.raw`^${UID}\s*=\s*${COLUMN}$`, 'i')
const COLUMN_FIRST = new RegExp(String.raw`^${COLUMN}\s*=\s*${UID}$`, 'i')
const ROLE_AUTHENTICATED = /^auth\.role\(\)\s*=\s*'authenticated'(?:::text)?$/i

/** What an expression says, or `undefined` when it is outside the translation table. */
export const termOf = (expression: string): Term | undefined => {
  const bare = unwrapped(expression).replace(/\s+/g, ' ')
  if (/^true$/i.test(bare)) return { kind: 'true' }
  if (ROLE_AUTHENTICATED.test(bare)) return { kind: 'authenticated' }
  const owned = UID_FIRST.exec(bare) ?? COLUMN_FIRST.exec(bare)
  const column = owned?.[1] ?? owned?.[2]
  return column === undefined ? undefined : { kind: 'owner', column }
}

const SUPABASE_ROLES: ReadonlySet<string> = new Set(['anon', 'authenticated', 'public'])

/** A term under a policy's roles, or `undefined` when the pair is not in the table. */
const translationOf = (
  term: Term,
  roles: readonly string[],
  owners: ReadonlySet<string>
): PolicyTranslation | undefined => {
  if (term.kind === 'authenticated') return { grant: 'authenticated' }
  if (term.kind === 'true') {
    return {
      grant: roles.some((role) => role === 'anon' || role === 'public') ? 'all' : 'authenticated',
    }
  }
  return owners.has(term.column) && !roles.includes('anon')
    ? { grant: 'authenticated', owner: term.column }
    : undefined
}

/** The expressions a policy's command is judged on. */
const expressionsOf = (policy: Policy): readonly (string | undefined)[] => {
  if (policy.command === 'INSERT') return [policy.check]
  if (policy.command === 'SELECT' || policy.command === 'DELETE') return [policy.using]
  return [policy.using ?? policy.check, policy.check ?? policy.using]
}

const sameTranslation = (a: PolicyTranslation, b: PolicyTranslation): boolean =>
  a.grant === b.grant && a.owner === b.owner

const CLOSED_ADVICE =
  'so what it governs is closed to admin. Open the operation deliberately, and for rows only their owner may reach, use the owner-only recipe of the table permissions documentation.'

/** A policy's translation, or why it has none. */
export const translatePolicy = (
  policy: Policy,
  owners: ReadonlySet<string>
): PolicyTranslation | { readonly unmapped: string } => {
  if (!policy.permissive)
    return { unmapped: `A restrictive policy is not translated, ${CLOSED_ADVICE}` }
  if (policy.roles.length === 0 || policy.roles.some((role) => !SUPABASE_ROLES.has(role))) {
    return { unmapped: `The policy applies to a role Sovrium does not have, ${CLOSED_ADVICE}` }
  }
  const translations = expressionsOf(policy).map((expression) => {
    const term = expression === undefined ? undefined : termOf(expression)
    return term === undefined ? undefined : translationOf(term, policy.roles, owners)
  })
  const [first] = translations
  return first !== undefined &&
    translations.every((one) => one !== undefined && sameTranslation(one, first))
    ? first
    : { unmapped: `The expression is outside the translation table, ${CLOSED_ADVICE}` }
}

const OPERATIONS = [
  { operation: 'read', command: 'SELECT', rule: 'read' },
  { operation: 'create', command: 'INSERT', rule: 'create' },
  { operation: 'update', command: 'UPDATE', rule: 'write' },
  { operation: 'delete', command: 'DELETE', rule: 'delete' },
] as const

type Operation = TableSection['operations'][number]

/** One operation's outcome, and the policies a clash of grants left unmapped. */
interface OperationOutcome {
  readonly report: Operation
  readonly owners: readonly string[] | undefined
  readonly clashed: readonly string[]
}

const closed = (operation: Operation['operation'], clashed: readonly string[] = []) => ({
  report: { operation, outcome: 'closed' as const },
  owners: undefined,
  clashed,
})

const operationOf = (
  spec: (typeof OPERATIONS)[number],
  security: NonNullable<CanonicalTable['rowSecurity']>,
  translated: ReadonlyMap<string, ReturnType<typeof translatePolicy>>
): OperationOutcome => {
  const covering = security.policies.filter(
    (policy) => policy.command === spec.command || policy.command === 'ALL'
  )
  if (!security.enabled || covering.length === 0) return closed(spec.operation)
  const results = covering.map((policy) => translated.get(policy.name))
  const mapped = results.flatMap((one) => (one === undefined || 'unmapped' in one ? [] : [one]))
  if (mapped.length !== results.length) return closed(spec.operation)
  const grants = new Set(mapped.map((one) => one.grant))
  const [grant] = grants
  if (grant === undefined || grants.size > 1) {
    return closed(
      spec.operation,
      covering.map((policy) => policy.name)
    )
  }
  const owners = mapped.some((one) => one.owner === undefined)
    ? undefined
    : [...new Set(mapped.flatMap((one) => (one.owner === undefined ? [] : [one.owner])))]
  return {
    report: {
      operation: spec.operation,
      outcome: 'translated',
      grant,
      ...(owners?.length === 1 ? { ownerField: owners[0] ?? '' } : {}),
    },
    owners,
    clashed: [],
  }
}

const ownerRule = (fields: readonly string[]) => {
  const conditions = fields.map((field) => ({ field, operator: 'eq', value: '$currentUser.id' }))
  return { when: conditions.length === 1 ? conditions[0] : { logic: 'or', conditions } }
}

/** The text a report quotes a policy with: its expressions, as the source stored them. */
const quoted = (policy: Policy): string | undefined =>
  policy.using !== undefined && policy.check !== undefined && policy.check !== policy.using
    ? `${policy.using} WITH CHECK ${policy.check}`
    : (policy.using ?? policy.check)

const RLS_OFF_REASON =
  "Row-level security was off in the source, so anyone holding the project's public key could read and write this table; it is imported closed to admin. Open its operations deliberately."

/** One table's access as written, reported, and left to do. */
const tableAccess = (
  mapped: MappedTable,
  security: NonNullable<CanonicalTable['rowSecurity']>
): {
  readonly entry: ConfigEntry
  readonly section: TableSection
  readonly todo: readonly Todo[]
} => {
  const fieldBySource = new Map(
    mapped.fields
      .filter((field) => field.type === 'user' && field.source.sourceType === 'auth.users')
      .map((field) => [field.source.sourceId, field.name] as const)
  )
  const owners = new Set(fieldBySource.keys())
  const translated = new Map(
    security.policies.map((policy) => [policy.name, translatePolicy(policy, owners)] as const)
  )
  const outcomes = OPERATIONS.map((spec) => operationOf(spec, security, translated))
  const clashed = new Set(outcomes.flatMap((one) => one.clashed))
  const rules = OPERATIONS.flatMap((spec, index) => {
    const owned = outcomes[index]?.owners
    return owned === undefined || owned.length === 0
      ? []
      : [
          [
            spec.rule,
            ownerRule(owned.map((column) => fieldBySource.get(column) ?? column)),
          ] as const,
        ]
  })
  const operations = outcomes.map((one) => {
    const field = one.report.ownerField
    return field === undefined
      ? one.report
      : { ...one.report, ownerField: fieldBySource.get(field) ?? field }
  })
  const policies = security.policies.map((policy) => {
    const result = translated.get(policy.name)
    const unmapped =
      result !== undefined && 'unmapped' in result
        ? result.unmapped
        : clashed.has(policy.name)
          ? `Policies under different roles cover one operation, ${CLOSED_ADVICE}`
          : undefined
    const expression = quoted(policy)
    return {
      policy: policy.name,
      command: policy.command,
      roles: policy.roles,
      ...(expression === undefined ? {} : { expression }),
      outcome: unmapped === undefined ? ('mapped' as const) : ('unmapped' as const),
      ...(unmapped === undefined ? {} : { reason: unmapped }),
    }
  })
  const target = `tables.${mapped.name}.permissions`
  const todo: readonly Todo[] = [
    ...(security.enabled
      ? []
      : [
          {
            domain: 'tables' as const,
            target,
            original: 'row level security disabled',
            reason: RLS_OFF_REASON,
          },
        ]),
    ...policies.flatMap((policy) =>
      policy.reason === undefined
        ? []
        : [
            {
              domain: 'tables' as const,
              target,
              original: `${policy.policy}: ${policy.command} TO ${policy.roles.join(', ')}${policy.expression === undefined ? '' : ` ${policy.expression}`}`,
              reason: policy.reason,
            },
          ]
    ),
  ]
  const permissions = Object.fromEntries(
    operations.map((one) => [one.operation, one.outcome === 'translated' ? one.grant : ['admin']])
  )
  return {
    entry: {
      ...mapped.entry,
      permissions,
      ...(rules.length === 0 ? {} : { rowLevelPermissions: Object.fromEntries(rules) }),
    },
    section: {
      table: mapped.name,
      source: mapped.source.name,
      rowSecurity: security.enabled ? 'enabled' : 'disabled',
      operations,
      policies,
    },
    todo,
  }
}

/**
 * The plan with each table's row-level security written as its permissions,
 * and the report's `permissions` section; the plan unchanged when no source
 * table carried row-level security.
 */
export const withRowSecurity = (
  plan: TablePlan
): TablePlan & { readonly permissions?: Section } => {
  const secured = plan.tables.map((mapped) => {
    const security = mapped.source.rowSecurity
    return security === undefined ? undefined : tableAccess(mapped, security)
  })
  if (secured.every((one) => one === undefined)) return plan
  return {
    ...plan,
    tables: plan.tables.map((mapped, index) => {
      const access = secured[index]
      return access === undefined ? mapped : { ...mapped, entry: access.entry }
    }),
    todo: [...plan.todo, ...secured.flatMap((one) => one?.todo ?? [])],
    permissions: { tables: secured.flatMap((one) => (one === undefined ? [] : [one.section])) },
  }
}
