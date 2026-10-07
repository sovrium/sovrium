/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `$invitation.*` values a `page.invitation` page prints, from what the
 * engine found for the token in its address (`invitation.ts` lists them).
 *
 * A token that matches nothing yields `status: invalid` and an empty string
 * for every other reference, so a forged or reused link says nothing about
 * whether an invitation ever existed.
 */

import { escapeRegExp } from '@/domain/kernel/sanitize/escape-regexp'

/** What the engine found for one invitation token. */
export interface InvitationFacts {
  readonly inviterName: string
  readonly inviterImage: string
  readonly email: string
  readonly role: string
  readonly expiresAt: string
  readonly accountExists: boolean
  readonly status: 'pending' | 'expired'
}

/** The reference names, as written after `$invitation.`. */
const REFERENCES = [
  'inviter.name',
  'inviter.image',
  'email',
  'role',
  'workspace',
  'expiresAt',
  'accountExists',
  'status',
] as const

type InvitationReference = (typeof REFERENCES)[number]

/** The value of every `$invitation.*` reference, for `facts` (none: an invalid token). */
export const invitationVarValues = (
  facts: InvitationFacts | undefined,
  workspace: string
): Readonly<Record<InvitationReference, string>> =>
  facts === undefined
    ? {
        'inviter.name': '',
        'inviter.image': '',
        email: '',
        role: '',
        workspace: '',
        expiresAt: '',
        accountExists: '',
        status: 'invalid',
      }
    : {
        'inviter.name': facts.inviterName,
        'inviter.image': facts.inviterImage,
        email: facts.email,
        role: facts.role,
        workspace,
        expiresAt: facts.expiresAt,
        accountExists: String(facts.accountExists),
        status: facts.status,
      }

// Longest names first, so `inviter.name` is not read as `inviter` + `.name`.
const REFERENCE_PATTERN = new RegExp(
  `\\$invitation\\.(${[...REFERENCES]
    .toSorted((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')})`,
  'g'
)

/** `text` with every `$invitation.*` reference replaced by its value. */
export const substituteInvitationVars = (
  text: string,
  values: Readonly<Record<InvitationReference, string>>
): string =>
  text.includes('$invitation.')
    ? text.replaceAll(
        REFERENCE_PATTERN,
        (_match, name: string) => values[name as InvitationReference]
      )
    : text

/** A `visibility.condition` as authored: `{ field, operator, value }`. */
export interface InvitationCondition {
  readonly field: string
  readonly operator: string
  readonly value: string
}

/**
 * Whether a `visibility.condition` on `$invitation.<name>` holds for `values`;
 * `undefined` when the condition reads anything else (`$user.*` is judged by
 * the session pass). An unknown reference reads as empty, and an operator other
 * than `eq` / `neq` never holds.
 */
export const invitationConditionHolds = (
  condition: InvitationCondition,
  values: Readonly<Record<InvitationReference, string>>
): boolean | undefined => {
  if (!condition.field.startsWith('$invitation.')) return undefined
  const name = condition.field.slice('$invitation.'.length)
  const actual = (values as Readonly<Record<string, string>>)[name] ?? ''
  if (condition.operator === 'eq') return actual === condition.value
  if (condition.operator === 'neq') return actual !== condition.value
  return false
}
