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
import { relativeOffset } from '@/domain/kernel/time/relative-offset'

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
  'expiresAt.relative',
  'expiresAt.iso',
  'accountExists',
  'status',
] as const

type InvitationReference = (typeof REFERENCES)[number]

/** How the page prints the invitation: whose it is, in which language and zone, and when. */
export interface InvitationVarContext {
  /** The app's display name (`$app.label`). */
  readonly workspace: string
  /** The page's language tag; an unknown one reads as English. */
  readonly lang: string
  /** The IANA zone the date is printed in. */
  readonly timeZone: string
  /** The instant `.relative` counts from. */
  readonly now: Readonly<Date>
}

/** `fn(lang)`, or `fn('en')` when `lang` is not a tag `Intl` accepts. */
const inLanguage = <T>(lang: string, fn: (tag: string) => T): T => {
  try {
    return fn(lang)
  } catch {
    return fn('en')
  }
}

/** `instant` as a long date (`14 March 2031`), in `lang` and `timeZone`. */
export const formatInvitationDeadline = (
  instant: Readonly<Date>,
  lang: string,
  timeZone: string
): string =>
  inLanguage(lang, (tag) =>
    new Intl.DateTimeFormat(tag, { dateStyle: 'long', timeZone }).format(instant as Date)
  )

/**
 * The time from `now` to `instant` (`in 3 days`, `2 days ago`), in `lang`: the
 * largest unit — days, else hours, else minutes — that holds a whole one,
 * counted down to whole units.
 */
export const formatInvitationRelative = (
  instant: Readonly<Date>,
  now: Readonly<Date>,
  lang: string
): string => {
  const { count, unit } = relativeOffset(instant.getTime() - now.getTime())
  return inLanguage(lang, (tag) =>
    new Intl.RelativeTimeFormat(tag, { numeric: 'always' }).format(count, unit)
  )
}

/** The value of every `$invitation.*` reference, for `facts` (none: an invalid token). */
export const invitationVarValues = (
  facts: InvitationFacts | undefined,
  context: InvitationVarContext
): Readonly<Record<InvitationReference, string>> => {
  if (facts === undefined)
    return {
      'inviter.name': '',
      'inviter.image': '',
      email: '',
      role: '',
      workspace: '',
      expiresAt: '',
      'expiresAt.relative': '',
      'expiresAt.iso': '',
      accountExists: '',
      status: 'invalid',
    }
  const deadline = new Date(facts.expiresAt)
  const valid = !Number.isNaN(deadline.getTime())
  return {
    'inviter.name': facts.inviterName,
    'inviter.image': facts.inviterImage,
    email: facts.email,
    role: facts.role,
    workspace: context.workspace,
    expiresAt: valid ? formatInvitationDeadline(deadline, context.lang, context.timeZone) : '',
    'expiresAt.relative': valid
      ? formatInvitationRelative(deadline, context.now, context.lang)
      : '',
    'expiresAt.iso': facts.expiresAt,
    accountExists: String(facts.accountExists),
    status: facts.status,
  }
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
  /** A boolean value never equals an invitation field, which is always text. */
  readonly value: string | boolean
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
