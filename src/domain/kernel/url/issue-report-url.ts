/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { redactIssueReportText } from '@/domain/kernel/sanitize/issue-report-redaction'

/**
 * The one place in `src/` that knows how to send someone to a prefilled
 * GitHub issue form.
 *
 * Every surface that offers "report this problem" — the CLI, the server's
 * error log line, the console, a failed automation run — builds its link here,
 * so the form field ids exist exactly once and a drift check can hold them
 * against `.github/ISSUE_TEMPLATE/*.yml`. Everything is pure: no clock, no
 * environment, no network. The caller decides WHEN to offer the link; this
 * module decides only what it says.
 */

/** Where every issue form lives. */
const ISSUES_NEW_URL = 'https://github.com/sovrium/sovrium/issues/new'

/** Security problems never go to a public issue: they go to the private advisory form. */
export const SECURITY_ADVISORY_URL = 'https://github.com/sovrium/sovrium/security/advisories/new'

/** The agent brief every form ends with, in form order. */
const BRIEF_FIELD_IDS = [
  'acceptance-criteria',
  'affected-paths',
  'verification',
  'out-of-scope',
  'related',
] as const

/** The two closing checkboxes every form carries. */
const CHECKBOX_FIELD_IDS = ['validated', 'ai-drafted'] as const

/**
 * Field ids per issue form file, in the order the form declares them.
 *
 * A CONTRACT: the issue-form drift check reads this record and compares it with
 * the `id:` keys of each `.github/ISSUE_TEMPLATE/<form>`. Rename an id in a form
 * and here in the same commit, or the gate fails.
 */
export const ISSUE_FORM_FIELD_IDS = {
  'bug.yml': [
    'version',
    'last-good-version',
    'install-channel',
    'database',
    'os',
    'domain',
    'bug-kind',
    'repro-config',
    'steps',
    'expected',
    'actual',
    'logs',
    'frequency',
    'workaround',
    ...BRIEF_FIELD_IDS,
    ...CHECKBOX_FIELD_IDS,
  ],
  'feature-config-option.yml': [
    'domain',
    'problem',
    'schema-node',
    'sketch',
    'defaults',
    'audience',
    'docs-impact',
    ...BRIEF_FIELD_IDS,
    ...CHECKBOX_FIELD_IDS,
  ],
  'feature-engine-primitive.yml': [
    'domain',
    'problem',
    'why-not-composable',
    'runtime-surface',
    'security-impact',
    'performance-impact',
    ...BRIEF_FIELD_IDS,
    ...CHECKBOX_FIELD_IDS,
  ],
  'feature-recipe.yml': [
    'domain',
    'use-case',
    'primitives',
    'gap',
    'delivery',
    ...BRIEF_FIELD_IDS,
    ...CHECKBOX_FIELD_IDS,
  ],
  'task.yml': [
    'domain',
    'goal',
    'scope',
    'definition-of-done',
    ...BRIEF_FIELD_IDS,
    ...CHECKBOX_FIELD_IDS,
  ],
} as const

/** An issue form file name. */
export type IssueFormName = keyof typeof ISSUE_FORM_FIELD_IDS

/** A field id the given form declares. Any other id is a type error. */
export type IssueFormFieldId<F extends IssueFormName> = (typeof ISSUE_FORM_FIELD_IDS)[F][number]

/**
 * The exact option strings of the forms' fixed-choice dropdowns: a prefilled
 * value must match an option byte for byte. `domain` and `bug-kind` are
 * dropdowns too, but their options are bare values (`tables`, `regression`)
 * and are typed as plain strings.
 */
export const ISSUE_FORM_DROPDOWN_OPTIONS = {
  'install-channel': ['Binary', 'Desktop app', 'Docker', 'Homebrew', 'Scoop', 'Built from source'],
  database: ['SQLite', 'PostgreSQL'],
  frequency: ['Every time', 'Sometimes', 'Happened once'],
  audience: ['The operator (configuration and /_admin)', "The app's end users", 'Both'],
  delivery: ['A library recipe (sovrium library)', 'A starter template (sovrium init)', 'Not sure'],
} as const

/** A dropdown whose options are fixed. */
export type IssueFormDropdownId = keyof typeof ISSUE_FORM_DROPDOWN_OPTIONS

/** The value a field accepts: one of its options for a fixed dropdown, any text otherwise. */
export type IssueFormFieldValue<K extends string> = K extends IssueFormDropdownId
  ? (typeof ISSUE_FORM_DROPDOWN_OPTIONS)[K][number]
  : string

/** The fields a form can be prefilled with, each typed by its id. */
export type IssueFormFields<F extends IssueFormName> = {
  readonly [K in IssueFormFieldId<F>]?: IssueFormFieldValue<K>
}

/** What a prefilled report link is built from. */
export interface IssueReportInput<F extends IssueFormName> {
  readonly form: F
  /** The issue's title; empty leaves the form's own placeholder. */
  readonly title: string
  readonly fields?: IssueFormFields<F>
}

/**
 * GitHub documents URL prefill for text fields only; whether a dropdown
 * accepts its value from the URL is unverified. So dropdown values are still
 * sent as their own params, AND mirrored into one text field per form that
 * surely accepts prefill, as an `Environment` block PREPENDED to that field's
 * text — at the head, so truncation (which keeps the head) never cuts it off.
 */
export const DROPDOWN_MIRROR = {
  'bug.yml': {
    target: 'steps',
    dropdowns: ['install-channel', 'database', 'domain', 'bug-kind', 'frequency'],
  },
  'feature-config-option.yml': { target: 'problem', dropdowns: ['domain', 'audience'] },
  'feature-engine-primitive.yml': { target: 'problem', dropdowns: ['domain'] },
  'feature-recipe.yml': { target: 'use-case', dropdowns: ['domain', 'delivery'] },
  'task.yml': { target: 'goal', dropdowns: ['domain'] },
} as const satisfies {
  readonly [F in IssueFormName]: {
    readonly target: IssueFormFieldId<F>
    readonly dropdowns: readonly IssueFormFieldId<F>[]
  }
}

/** The heading of the mirrored block. */
export const ENVIRONMENT_BLOCK_HEADING = 'Environment'

/**
 * The longest link handed out. Browsers and GitHub accept more, but a link much
 * past this is cut by terminals, mail clients and proxies before it arrives.
 */
export const MAX_ISSUE_REPORT_URL_LENGTH = 6000

/** What a shortened value ends with, so the reader knows text is missing. */
export const TRUNCATION_MARKER = '…[truncated]'

// --- URL building ----------------------------------------------------------

/** One query parameter, value already redacted but not yet encoded. */
interface ReportParam {
  readonly name: string
  readonly value: string
}

/** The field truncated first when the link is too long. */
const FIRST_TO_TRUNCATE = 'logs'

const encodedLength = (text: string): number => encodeURIComponent(text).length

const renderUrl = (form: string, params: readonly ReportParam[]): string =>
  `${ISSUES_NEW_URL}?${[{ name: 'template', value: form }, ...params]
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join('&')}`

/**
 * The longest prefix of `value` that, followed by the marker, encodes to at
 * most `budget` characters. Counts by code point, so a surrogate pair is
 * never split.
 */
const truncateToEncodedBudget = (value: string, budget: number): string => {
  const room = budget - encodedLength(TRUNCATION_MARKER)
  const codePoints = Array.from(value)
  const cumulative = codePoints.reduce<readonly number[]>(
    (sums, char) => [...sums, (sums.at(-1) ?? 0) + encodedLength(char)],
    []
  )
  const kept = cumulative.filter((sum) => sum <= room).length
  return `${codePoints.slice(0, kept).join('')}${TRUNCATION_MARKER}`
}

/** The param to shorten next: `logs` first, then the longest; never one already reduced to the marker. */
const nextToTruncate = (params: readonly ReportParam[]): ReportParam | undefined => {
  const shrinkable = params.filter((param) => param.value !== TRUNCATION_MARKER)
  const logs = shrinkable.find((param) => param.name === FIRST_TO_TRUNCATE)
  if (logs !== undefined) return logs
  return shrinkable.reduce<ReportParam | undefined>(
    (longest, param) =>
      longest === undefined || encodedLength(param.value) > encodedLength(longest.value)
        ? param
        : longest,
    undefined
  )
}

/** Shorten params, one at a time, until the rendered link fits the budget. */
const fitToBudget = (form: string, params: readonly ReportParam[]): readonly ReportParam[] => {
  const overflow = renderUrl(form, params).length - MAX_ISSUE_REPORT_URL_LENGTH
  if (overflow <= 0) return params
  const target = nextToTruncate(params)
  if (target === undefined) return params
  const shortened = truncateToEncodedBudget(
    target.value,
    Math.max(0, encodedLength(target.value) - overflow)
  )
  return fitToBudget(
    form,
    params.map((param) => (param === target ? { name: param.name, value: shortened } : param))
  )
}

/**
 * `fields` with the form's dropdown values copied, as an `Environment` block,
 * to the head of its mirror text field. No dropdown value set: unchanged.
 */
const withMirroredDropdowns = (
  form: IssueFormName,
  fields: Readonly<Record<string, string | undefined>>
): Readonly<Record<string, string | undefined>> => {
  const { target, dropdowns } = DROPDOWN_MIRROR[form]
  const lines = (dropdowns as readonly string[])
    .filter((id) => fields[id] !== undefined && fields[id] !== '')
    .map((id) => `- ${id}: ${fields[id] ?? ''}`)
  if (lines.length === 0) return fields
  const block = [`${ENVIRONMENT_BLOCK_HEADING}:`, ...lines].join('\n')
  const existing = fields[target]
  return {
    ...fields,
    [target]: existing === undefined || existing === '' ? block : `${block}\n\n${existing}`,
  }
}

/**
 * A link to the prefilled GitHub issue form.
 *
 * Dropdown values are also mirrored into a text field (see
 * {@link DROPDOWN_MIRROR}). Only the ids the form declares are carried (a
 * caller outside the type system gets the unknown ones dropped), empty values are omitted, every value is
 * redacted, and the whole link is held under {@link MAX_ISSUE_REPORT_URL_LENGTH}
 * by truncating `logs` first, then the longest remaining text, each marked with
 * {@link TRUNCATION_MARKER}.
 */
export const buildIssueReportUrl = <F extends IssueFormName>(
  input: IssueReportInput<F>
): string => {
  const known: readonly string[] = ISSUE_FORM_FIELD_IDS[input.form]
  const fields = withMirroredDropdowns(input.form, input.fields ?? {})
  const fieldParams = known
    .map((name) => ({ name, value: fields[name] }))
    .filter((param): param is ReportParam => param.value !== undefined && param.value !== '')
    .map(({ name, value }) => ({ name, value: redactIssueReportText(value) }))
  // No title at all, rather than an empty one: the person names their own problem.
  const titleParams: readonly ReportParam[] =
    input.title === '' ? [] : [{ name: 'title', value: redactIssueReportText(input.title) }]
  const params: readonly ReportParam[] = [...titleParams, ...fieldParams]
  return renderUrl(input.form, fitToBudget(input.form, params))
}

// --- Error signature -------------------------------------------------------

/** How many in-repo frames identify a crash. More makes a refactor split one bug in two. */
const SIGNATURE_FRAME_COUNT = 3

/** A V8/JSC stack line: `at fn (location)` or `at location`. */
const STACK_FRAME = /^\s*at\s+(?:(.+?)\s+\()?(.+?)\)?\s*$/

/** Whether a line of text is a stack frame (`   at …`). */
const STACK_FRAME_LINE = /^\s*at\s/

/** A frame in a dependency or in the runtime itself, never Sovrium's own code. */
const FOREIGN_FRAME = /node_modules|\(node:/

/** The `at …` lines of a stack, in order. */
const stackFrameLines = (stack: string | undefined): readonly string[] =>
  (stack ?? '').split('\n').filter((line) => STACK_FRAME_LINE.test(line))

/** How many frames a report keeps of a failure's stack. */
export const REPORTED_FRAME_COUNT = 8

/**
 * The frames a report carries of `stack`: its `at …` lines, without a
 * dependency's or the runtime's own, at most {@link REPORTED_FRAME_COUNT}.
 * Kept as written; the caller scrubs paths.
 */
export const reportedStackFrames = (stack: string | undefined): readonly string[] =>
  stackFrameLines(stack)
    .filter((line) => !FOREIGN_FRAME.test(line))
    .slice(0, REPORTED_FRAME_COUNT)

/** Whether `text` already holds a stack frame on a line after its first. */
export const hasStackFrames = (text: string): boolean => /\n\s*at\s/.test(text)

/** `:line` or `:line:col` at the end of a location. */
const LINE_COLUMN_SUFFIX = /(?::\d+){1,2}$/

/** What an error looks like to the signature: an `Error` passes as-is. */
export interface ErrorSignatureInput {
  readonly name: string
  readonly stack?: string | undefined
}

/**
 * A frame's location as a repo-relative module path, or `undefined` when the
 * frame is outside the repository (a dependency, the runtime, native code).
 * Absolute prefixes, `file://`, Windows separators, the compiled binary's
 * `$bunfs` root and query strings all fall away, so one bug hashes the same on
 * every machine.
 */
const inRepoModulePath = (location: string): string | undefined => {
  const path = location
    .replace(LINE_COLUMN_SUFFIX, '')
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/')
    .replace(/\?.*$/, '')
  if (path.includes('/node_modules/')) return undefined
  const srcIndex = path.lastIndexOf('/src/')
  if (srcIndex !== -1) return path.slice(srcIndex + 1)
  return path.startsWith('src/') ? path : undefined
}

/** One frame's identity: function name plus module path, never line or column. */
const frameIdentity = (line: string): string | undefined => {
  const match = STACK_FRAME.exec(line)
  if (match === null) return undefined
  const modulePath = inRepoModulePath(match[2] ?? '')
  if (modulePath === undefined) return undefined
  const fn = (match[1] ?? '').replace(/^async\s+/, '')
  return `${fn}@${modulePath}`
}

/** FNV-1a, 32 bits, as eight lowercase hex digits. */
const fnv1a32Hex = (text: string): string =>
  (
    Array.from(text).reduce(
      (hash, char) => Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16_777_619),
      0x81_1c_9d_c5
    ) >>> 0
  )
    .toString(16)
    .padStart(8, '0')

/**
 * An 8-hex-digit fingerprint of a crash: its error class plus its top
 * in-repo frames. Stable across line/column shifts and install paths, so the
 * same bug reported twice carries the same `sig:` and a search finds the first.
 */
export const computeErrorSignature = (error: ErrorSignatureInput): string => {
  const frames = stackFrameLines(error.stack)
    .map(frameIdentity)
    .filter((frame): frame is string => frame !== undefined)
    .slice(0, SIGNATURE_FRAME_COUNT)
  return fnv1a32Hex([error.name, ...frames].join('\n'))
}

/** The issue title a crash is reported under: the command, the error class, then the signature as a bracketed `sig:` tag. */
export const formatIssueTitle = (command: string, errorClass: string, signature: string): string =>
  `${command}: ${errorClass} [sig:${signature}]`
