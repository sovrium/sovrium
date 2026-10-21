/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ALL_HELPERS } from './template'

/**
 * WHAT AN AUTHORED TEMPLATE CAN READ OF A RUN.
 *
 * A step's props are rendered against the run's template context: the trigger
 * under `trigger`, each earlier step's result under its own name and under
 * `steps.<name>`, the env values an authored `$env.X` inserts under `$env`,
 * and loop items under `loop` / `loops`. A rendered value can only carry what
 * its template read, so a reader who may see every value the template read
 * may see the rendered value too.
 *
 * The answer is a feed: whether the template reads the trigger, and which
 * steps it reads by name — or `unknown` when it uses anything whose source
 * cannot be named from the text alone: the whole context (`this`, `@root`,
 * `..`), a partial, a dynamic lookup, a bracketed segment, a loop item, a
 * template variable, the whole `steps` map, or any root that is neither a
 * step, the trigger, a helper nor a literal. An env value or a template
 * variable (`$env.X`, `$name`, in or out of a tag) is `unknown` too: it is not
 * the run's data, but showing it is the earlier rule's call, not this one's.
 * So is a tag the engine may read differently from this scan (a backslash,
 * which escapes a quote), and a
 * helper call that may hand on the engine's own call options — which carry the
 * whole context — rather than a value: a nested call given no argument, or a
 * nested call whose result a helper that takes values apart receives. A caller
 * treats `unknown` as "reads everything the run had" (fail closed).
 */
export type TemplateFeed =
  | { readonly kind: 'known'; readonly trigger: boolean; readonly steps: ReadonlySet<string> }
  | { readonly kind: 'unknown' }

const UNKNOWN: TemplateFeed = { kind: 'unknown' }

/** Every `{{…}}` tag of a template, comments and closers included; `{{{…}}}` reads as `{{…}}`. */
const TAG = /\{\{\{?([\s\S]*?)\}?\}\}/g

/** Constructs whose source cannot be named from the text: whole context, partials, lookups. */
const OPAQUE = /(^|[^\w$@])(this|@root|lookup)(?![\w$])|\.\.|\[|^\s*~?\s*[>{]/

/** Quoted string arguments: their text is a literal, never a path. */
const QUOTED = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g

/** Hash argument keys (`key=`): the value after them is read, the key is not. */
const HASH_KEY = /[\w$]+\s*=/g

/** Block and whitespace-control markers a tag may open with. */
const TAG_MARKERS = /^[\s~#^/&!*]*(else\b)?/

/** Handlebars' own block helpers, beside the engine's registered ones. */
const BUILTIN_HELPERS: ReadonlySet<string> = new Set(['if', 'unless', 'each', 'with', 'log', 'as'])

/** Roots that read nothing of a run: helpers, loop position metadata, literals. */
const SAFE_ROOTS: ReadonlySet<string> = new Set([
  ...ALL_HELPERS,
  ...BUILTIN_HELPERS,
  '@index',
  '@key',
  '@first',
  '@last',
  'true',
  'false',
  'null',
  'undefined',
])

/** An authored `$env.X` or `$name` reference, which the run fills in with a value. */
const AUTHORED_REFERENCE = /\$[A-Za-z_]/

const NUMBER = /^-?\d+(\.\d+)?$/

/** Helpers that read no argument; any other nested call given none receives the call options. */
const NULLARY_HELPERS: ReadonlySet<string> = new Set(['now', 'today', 'timestamp', 'pageBreak'])

/** A nested call given no argument: `(name)`. */
const BARE_SUBEXPRESSION = /\(\s*([^\s()]+)\s*\)/g

/**
 * Helpers that return a part, a copy or a serialisation of the value they are
 * given. Handed the call options a nested call returned (`(default x)` with `x`
 * blank returns them), they pass the whole context on.
 */
const DISSECTING_HELPERS =
  /(^|[^\w$@.])(values|keys|pick|omit|get|flatten|first|last|at|unique|chunk|slice|reverseArray|join|json|stringify)(?![\w$])/

/** True when a tag may hand the engine's call options on as a value (see the module header). */
const mayPassCallOptions = (body: string): boolean => {
  const unquoted = body.replace(QUOTED, ' ')
  const bare = [...unquoted.matchAll(BARE_SUBEXPRESSION)].some(
    ([, name = '']) => !NULLARY_HELPERS.has(name)
  )
  return bare || (unquoted.includes('(') && DISSECTING_HELPERS.test(unquoted))
}

/** The path-like words of one tag's body, quoted literals and hash keys removed. */
const wordsOf = (body: string): readonly string[] =>
  body
    .replace(TAG_MARKERS, '')
    .replace(QUOTED, ' ')
    .replace(HASH_KEY, ' ')
    .split(/[\s()|=~]+/)
    .filter((word) => word !== '' && !NUMBER.test(word))

/** What one word reads: the trigger, a step by name, nothing, or something unnamed. */
type Read = 'trigger' | 'nothing' | 'unknown' | { readonly step: string }

/**
 * The run context writes `steps` after the step names, so `steps` is always the
 * map, even when a step bears that name; and `trigger` is the trigger or a step
 * so named depending on where the template runs, so that pair names neither.
 */
const readOf = (word: string, stepNames: ReadonlySet<string>): Read => {
  const [root = '', next] = word.split(/[./]/)
  if (root === 'steps')
    return next !== undefined && stepNames.has(next) ? { step: next } : 'unknown'
  if (root === 'trigger') return stepNames.has('trigger') ? 'unknown' : 'trigger'
  if (stepNames.has(root)) return { step: root }
  return SAFE_ROOTS.has(root) ? 'nothing' : 'unknown'
}

/**
 * What `template` reads of a run whose automation declares `stepNames`. A
 * template without a tag is a literal and reads nothing.
 */
export const templateFeed = (template: string, stepNames: ReadonlySet<string>): TemplateFeed => {
  const bodies = [...template.matchAll(TAG)].map((match) => match[1] ?? '')
  if (template.includes('{{') && bodies.length === 0) return UNKNOWN
  if (AUTHORED_REFERENCE.test(template)) return UNKNOWN
  if (bodies.some((body) => body.trimStart().startsWith('!'))) return UNKNOWN
  if (bodies.some((body) => OPAQUE.test(body) || body.includes('\\') || mayPassCallOptions(body)))
    return UNKNOWN
  const reads = bodies.flatMap(wordsOf).map((word) => readOf(word, stepNames))
  if (reads.includes('unknown')) return UNKNOWN
  return {
    kind: 'known',
    trigger: reads.includes('trigger'),
    steps: new Set(reads.flatMap((read) => (typeof read === 'object' ? [read.step] : []))),
  }
}
