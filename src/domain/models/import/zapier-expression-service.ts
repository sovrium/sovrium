/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Zapier mapping tokenizer.
 *
 * A Zapier input holds "curlies", `{{ … }}`, each naming a field of an earlier
 * step. How a curly names its step is not documented for the account export,
 * so the forms read are a table ({@link ZAPIER_REFERENCE_FORMS}), each row
 * carrying how far it is verified. A curly matching no row is kept verbatim as
 * an `unsupported` token. Zapier curlies hold no functions: formatting is a
 * Formatter step of its own.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import type { CanonicalExpression, CanonicalExpressionToken } from './canonical-flow'

/** One way a Zapier curly names a step and a field. */
export interface ZapierReferenceForm {
  /** What the form looks like. */
  readonly example: string
  /** Captures the step (group 1) and the field path (group 2). */
  readonly pattern: RegExp
  /** How the field path splits into keys. */
  readonly separator: string
  /** Whether the step is named by its id or by its alias. */
  readonly step: 'id' | 'alias'
  /** How far the form is verified, and against what. */
  readonly evidence: string
}

/**
 * The curly forms read, most specific first. A row whose form a real export
 * disproves is corrected here, never worked around in the adapter.
 */
export const ZAPIER_REFERENCE_FORMS: readonly ZapierReferenceForm[] = [
  {
    example: '{{123__email}}, {{1__channel__name}}',
    pattern: /^(\d+)__(.+)$/,
    separator: '__',
    step: 'id',
    evidence:
      'The editor form: a step id, then keys joined by a double underscore. Unverified: read in a third-party example and in a synthetic export only.',
  },
  {
    example: '{{crm-engagement-report.full_name}}',
    pattern: /^([A-Za-z][\w-]*)\.(.+)$/,
    separator: '.',
    step: 'alias',
    evidence: "Verified for the Workflow API's inputs, where a step is named by its alias.",
  },
]

/** What reading a curly needs besides its text. */
export interface ZapierScope {
  /** The trigger step's id: a reference to it reads the trigger's data. */
  readonly trigger: string | undefined
  /** The step id an alias names, or `undefined` when no step has it. */
  readonly alias?: (alias: string) => string | undefined
}

const refTo = (step: string, path: readonly string[], scope: ZapierScope) =>
  step === scope.trigger
    ? ({ kind: 'ref', root: 'trigger', path } as const)
    : ({ kind: 'ref', root: 'step', step, path } as const)

/** The token one curly becomes. */
const tokenOf = (part: string, scope: ZapierScope): CanonicalExpressionToken => {
  const inner = part.slice(2, -2).trim()
  const read = ZAPIER_REFERENCE_FORMS.flatMap((form) => {
    const match = form.pattern.exec(inner)
    const named = match?.[1]
    const step = form.step === 'id' ? named : named === undefined ? undefined : scope.alias?.(named)
    const path = match?.[2]?.split(form.separator) ?? []
    return step === undefined || path.some((key) => key === '') ? [] : [refTo(step, path, scope)]
  })
  return read[0] ?? { kind: 'unsupported', source: part }
}

/**
 * One Zapier input value: a string holding curlies tokenised, or the value
 * unchanged. Objects and arrays are walked.
 */
export const tokeniseZapierValue = (value: unknown, scope: ZapierScope): unknown => {
  if (Array.isArray(value)) return value.map((item) => tokeniseZapierValue(item, scope))
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, tokeniseZapierValue(item, scope)])
    )
  }
  if (typeof value !== 'string' || !value.includes('{{')) return value
  const tokens = value
    .split(/(\{\{[\s\S]*?\}\})/)
    .filter((part) => part !== '')
    .map((part): CanonicalExpressionToken =>
      part.startsWith('{{') ? tokenOf(part, scope) : { kind: 'text', value: part }
    )
  return { kind: 'expression', source: value, tokens } satisfies CanonicalExpression
}
