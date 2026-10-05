/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from './value-walker'

/**
 * The two references an automation author writes OUTSIDE `{{...}}`: an
 * environment variable (`$env.NAME`) and a reusable template's variable
 * (`$name`). Both are filled in from values the run holds, and a value is
 * filled in ONCE: it is never read again for `{{...}}`, `$env.` or `$name`.
 *
 * Two forms, chosen by what happens to the text next:
 *
 *  - {@link fillAuthoredReferences} inserts every value as text, in one pass,
 *    for text no template pass reads afterwards (a code action's source).
 *  - {@link referenceAuthoredValues} keeps the text a template, for text the
 *    template pass renders next: a variable becomes `{{$vars.name}}` and an
 *    env value that template syntax could read (one holding a brace or a
 *    backslash, or an empty one that would join two braces) becomes
 *    `{{$env.NAME}}`. The engine then inserts the VALUE found under that root
 *    of the context, which it never parses. The contexts the run renders
 *    against carry both roots ({@link ENV_TEMPLATE_ROOT},
 *    {@link VARS_TEMPLATE_ROOT}).
 *
 * The second form also keeps the template engine's compile cache bounded:
 * the text it compiles is the configuration as written, never a value that
 * arrived with a request.
 */

/** The context root under which a run's env lookup is exposed to templates. */
export const ENV_TEMPLATE_ROOT = '$env'

/** The context root under which a reusable template's variables are exposed. */
export const VARS_TEMPLATE_ROOT = '$vars'

/** `$env.NAME` (uppercase snake_case, as EnvVarSchema declares it) or `$name`. */
const AUTHORED_REFERENCE = /\$env\.([A-Z][A-Z0-9_]*)|\$([A-Za-z_][A-Za-z0-9_]*)/g

/**
 * One `{{...}}` (or `{{{...}}}`) expression of a template, or a comment, in
 * this order of alternatives:
 *
 *  1. a comment, `{{!-- ... --}}` or `{{! ... }}`;
 *  2. an expression whose quoted strings are read whole, as the template
 *     engine reads them, so a `}}` a string holds does not end the expression
 *     early and leave the rest of it to be treated as text outside one. Each
 *     piece of its body starts with a different character (a plain one, a lone
 *     `}`, `"`, `'`), so the scan never backtracks between them;
 *  3. an expression whose quote is never closed, ending at its first `}}`: the
 *     engine cannot parse it either, and keeps it as written.
 */
const MUSTACHE =
  /\{\{!--[\s\S]*?--\}\}|\{\{![\s\S]*?\}\}|\{\{\{(?:[^"'}]|\}(?!\})|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*\}\}\}|\{\{(?:[^"'}]|\}(?!\})|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*\}\}|\{\{\{[\s\S]*?\}\}\}|\{\{[\s\S]*?\}\}/g

/**
 * Inside an expression: a quoted string literal (whatever it holds), or a bare
 * reference. One pattern, so a literal turned into a path is not read again.
 */
const EXPRESSION_TOKEN = /"[^"]*"|'[^']*'|\$env\.([A-Z][A-Z0-9_]*)|\$([A-Za-z_][A-Za-z0-9_]*)/g

/** A piece of a quoted literal: text kept as written, or the path to a value. */
type LiteralPiece = { readonly text: string } | { readonly path: string }

export interface AuthoredReferenceValues {
  readonly envLookup: Readonly<Record<string, string>>
  /** A reusable template's variables; absent outside a template. */
  readonly vars?: Readonly<Record<string, unknown>>
}

const hasVar = (vars: AuthoredReferenceValues['vars'], name: string): boolean =>
  vars !== undefined && Object.prototype.hasOwnProperty.call(vars, name)

const varText = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value)

/** Whether template syntax could read an env value inserted as text. */
const isTemplateSafeText = (value: string): boolean => value !== '' && !/[{}\\]/.test(value)

/** Replace each reference in `input` with its value, in one pass. */
const fillReferencesInString = (input: string, values: AuthoredReferenceValues): string =>
  input.replace(
    AUTHORED_REFERENCE,
    (match, envKey: string | undefined, name: string | undefined) => {
      if (envKey !== undefined) return values.envLookup[envKey] ?? ''
      return name !== undefined && hasVar(values.vars, name) ? varText(values.vars?.[name]) : match
    }
  )

/** The path a reference inside a quoted literal reads, or undefined to keep it as text. */
const literalReferencePath = (
  envKey: string | undefined,
  name: string | undefined,
  values: AuthoredReferenceValues
): string | undefined => {
  if (envKey !== undefined) return `${ENV_TEMPLATE_ROOT}.${envKey}`
  return name !== undefined && hasVar(values.vars, name)
    ? `${VARS_TEMPLATE_ROOT}.${name}`
    : undefined
}

/** Split a literal's text into text pieces and the paths of its references. */
const literalPieces = (
  body: string,
  values: AuthoredReferenceValues
): ReadonlyArray<LiteralPiece> => {
  const matches = [...body.matchAll(AUTHORED_REFERENCE)]
  const { pieces, end } = matches.reduce<{
    readonly pieces: ReadonlyArray<LiteralPiece>
    readonly end: number
  }>(
    (acc, match) => {
      const path = literalReferencePath(match[1], match[2], values)
      if (path === undefined) return acc
      const before = body.slice(acc.end, match.index)
      return {
        pieces: [...acc.pieces, ...(before === '' ? [] : [{ text: before }]), { path }],
        end: match.index + match[0].length,
      }
    },
    { pieces: [], end: 0 }
  )
  const rest = body.slice(end)
  return [...pieces, ...(rest === '' ? [] : [{ text: rest }])]
}

/**
 * A quoted literal holding references reads their values: `"$name"` becomes
 * the path `$vars.name`, and `"Hi $name"` the subexpression
 * `(concat "Hi " $vars.name)`. The value is an argument the helper receives,
 * never text of the expression, so a quote or `}}` in it ends nothing.
 */
const referenceInsideLiteral = (literal: string, values: AuthoredReferenceValues): string => {
  const quote = literal.charAt(0)
  const pieces = literalPieces(literal.slice(1, -1), values)
  if (!pieces.some((piece) => 'path' in piece)) return literal
  const [only] = pieces
  if (pieces.length === 1 && only !== undefined && 'path' in only) return only.path
  const operands = pieces.map((piece) =>
    'path' in piece ? piece.path : `${quote}${piece.text}${quote}`
  )
  return `(concat ${operands.join(' ')})`
}

/**
 * Inside an expression a reference is only ever read as a value: a bare
 * `$env.NAME` stays the path `$env.NAME` (read under {@link ENV_TEMPLATE_ROOT}),
 * a bare `$name` becomes the path `$vars.name`, and a quoted literal holding
 * references reads them as values (see {@link referenceInsideLiteral}). No
 * value is ever written into the expression, so an expression the engine keeps
 * as written (an unknown helper, a syntax error, a refused `regex`) names the
 * reference, never its value. One pass.
 */
const referenceInsideExpression = (expression: string, values: AuthoredReferenceValues): string =>
  expression.replace(
    EXPRESSION_TOKEN,
    (match, envKey: string | undefined, name: string | undefined) => {
      if (envKey !== undefined) return `${ENV_TEMPLATE_ROOT}.${envKey}`
      if (name !== undefined) {
        return hasVar(values.vars, name) ? `${VARS_TEMPLATE_ROOT}.${name}` : match
      }
      return referenceInsideLiteral(match, values)
    }
  )

const referenceOutsideExpression = (text: string, values: AuthoredReferenceValues): string =>
  text.replace(
    AUTHORED_REFERENCE,
    (match, envKey: string | undefined, name: string | undefined) => {
      if (envKey !== undefined) {
        const value = values.envLookup[envKey] ?? ''
        return isTemplateSafeText(value) ? value : `{{${ENV_TEMPLATE_ROOT}.${envKey}}}`
      }
      return name !== undefined && hasVar(values.vars, name)
        ? `{{${VARS_TEMPLATE_ROOT}.${name}}}`
        : match
    }
  )

const referenceInString = (input: string, values: AuthoredReferenceValues): string => {
  const expressions = input.match(MUSTACHE) ?? []
  const texts = input.split(MUSTACHE)
  return texts
    .map((text, index) => {
      const expression = expressions[index]
      const filled = referenceOutsideExpression(text, values)
      return expression === undefined
        ? filled
        : filled + referenceInsideExpression(expression, values)
    })
    .join('')
}

/**
 * Insert every `$env.NAME` and `$name` value as text, in a single pass, so a
 * value is never read for another reference. For authored text no template
 * pass reads afterwards. An unknown env name becomes '', an unknown `$name`
 * stays as written (a literal `$5` survives).
 */
export const fillAuthoredReferences = <A>(authored: A, values: AuthoredReferenceValues): A =>
  mapStringsDeep(authored, (s) => fillReferencesInString(s, values)) as A

/**
 * Keep authored text a template whose `$env.NAME` and `$name` references the
 * template pass fills in as values. For authored text a template pass renders
 * next, against a context carrying {@link ENV_TEMPLATE_ROOT} and
 * {@link VARS_TEMPLATE_ROOT}.
 */
export const referenceAuthoredValues = <A>(authored: A, values: AuthoredReferenceValues): A =>
  mapStringsDeep(authored, (s) => referenceInString(s, values)) as A

/** The two roots a template rendered during a run reads references from. */
export const authoredReferenceRoots = (
  values: AuthoredReferenceValues
): Readonly<Record<string, unknown>> => ({
  [ENV_TEMPLATE_ROOT]: values.envLookup,
  [VARS_TEMPLATE_ROOT]: values.vars ?? {},
})

/** Whether a string is exactly one `{{$env.NAME}}` / `{{$vars.name}}` reference
 *  (a value to insert as it is, never re-typed). */
export const isAuthoredValueReference = (value: string): boolean =>
  /^\s*\{\{\s*\$(?:env|vars)\.\w+\s*\}\}\s*$/.test(value)
