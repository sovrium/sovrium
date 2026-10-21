/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * THE literal-token rule of the page grammar: what a token is, and how a single
 * backslash before one makes a page print it as text.
 *
 * ─── WHAT A TOKEN IS ────────────────────────────────────────────────────────
 *
 * A `$` followed by an ASCII letter or `_` starts a token. It runs through
 * letters, digits and `_`, then through any `.name` segments or one `:key`
 * (`$t:hero.title`). `$5`, `5$` and `$ ` start nothing. {@link tokenRunsIn} is
 * the one reader of that grammar, shared by the page renderer and by the page
 * migration, which escapes every run it finds in another tool's text.
 *
 * ─── HOW THE ESCAPE HOLDS ONCE, FOR EVERY ROOT ─────────────────────────────
 *
 * A page is filled by many passes — route parameters, page and template
 * variables, template inputs, `$app`, `$query`, `$window`, the signed-in user,
 * translations, records — each with its own pattern, and each keyed on a `$`.
 * Teaching every one of them to skip an escaped token is the scattered design
 * this module exists to replace. Instead the renderer runs two functions once:
 *
 * 1. {@link protectLiteralTokens} at the ENTRY of a render, before any pass:
 *    every `\$` that starts a token loses its backslash and its `$` becomes
 *    {@link LITERAL_DOLLAR}. No pass can fill what no longer holds a `$`, so no
 *    pass needs to know the escape exists, and a pass added later cannot get it
 *    wrong.
 * 2. {@link releaseLiteralTokens} on the FINISHED document, after every pass:
 *    each {@link LITERAL_DOLLAR} the server prints becomes `$` again. Nothing
 *    on the server runs after it, so a token printed by the escape is never
 *    filled afterwards. A payload the BROWSER reads and fills again — an
 *    island's JSON props, an inline script — gets the escape back instead
 *    (`\$`, written as JSON writes a backslash), because the browser's own
 *    readers honour it and would fill a bare `$`.
 *
 * Only the backslash directly before the `$` is consumed: `\\$app.name` keeps
 * its first backslash and prints `\$app.name`. A backslash before anything that
 * starts no token (`C:\Harbour`, `\$5`) is not touched.
 *
 * Data positions — a filter, a `dataSource`, a fetch body, a visibility or
 * access rule, a form's prefill — are read, not printed, so {@link protectLiteralTokensDeep}
 * leaves those subtrees exactly as written.
 */

/**
 * The stand-in for an escaped token's `$` between the two functions above.
 * U+FDD0 is a Unicode noncharacter, reserved for a program's internal use, so it
 * occurs in no author's text and no pass's pattern matches it.
 */
export const LITERAL_DOLLAR = '\uFDD0'

/**
 * The stand-in for an escaped token's `$` in browser text that nothing fills:
 * a confirm's title and message, which the gate prints as they are. Released as
 * a bare `$` everywhere, inside a browser payload too, so the reader sees the
 * token without its backslash. U+FDD5, clear of the inert stand-ins U+FDD0–FDD3
 * the session reader uses.
 */
const PRINTED_LITERAL_DOLLAR = '\uFDD5'

/**
 * A protected string the BROWSER prints without filling: each escaped token in
 * it is released as a bare `$` even inside a JSON payload, where an escaped
 * token otherwise gets its backslash back for the browser's readers.
 */
export const printedLiterally = (text: string): string =>
  text.replaceAll(LITERAL_DOLLAR, PRINTED_LITERAL_DOLLAR)

/** One token run: `$name`, then `.segment`s or one `:key` (whose key may hold dots). */
const TOKEN_RUN =
  /\$[A-Za-z_][A-Za-z0-9_]*(?:(?:\.[A-Za-z0-9_]+)+|:[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)?/g

/** A backslash directly before the `$` of a token run — the escape. */
const ESCAPED_TOKEN_START = /\\\$(?=[A-Za-z_])/g

/** Every token run a string carries, as written, in source order. */
export const tokenRunsIn = (text: string): readonly string[] =>
  text.includes('$') ? [...text.matchAll(TOKEN_RUN)].map(([run]) => run) : []

/**
 * One string with every escaped token protected: `\$app.name` becomes
 * `{@link LITERAL_DOLLAR}app.name`. A string with no escape is returned as is.
 */
export const protectLiteralTokens = (text: string): string =>
  text.includes('\\$') ? text.replace(ESCAPED_TOKEN_START, () => LITERAL_DOLLAR) : text

/** The body of each `<script>` element of a document. */
const SCRIPT_ELEMENT = /<script\b[^>]*>[\s\S]*?<\/script>/gi

/**
 * A double-quoted attribute value holding JSON (it opens with `{` or `[`): an
 * island's props and every other payload a browser script parses.
 */
const JSON_ATTRIBUTE = /="[{[][^"]*"/g

/** {@link LITERAL_DOLLAR}s of a browser payload, given back their escape in JSON spelling. */
const escapedForTheBrowser = (payload: string): string =>
  payload.replaceAll(LITERAL_DOLLAR, () => '\\\\$')

/**
 * A finished document with every protected token released: as the escaped
 * `\$` (in JSON spelling) inside a payload the browser reads and fills again,
 * as a bare `$` everywhere the server printed it — and as a bare `$` inside a
 * payload too where the text is one the browser prints unfilled
 * ({@link printedLiterally}).
 */
export const releaseLiteralTokens = (text: string): string =>
  text.includes(LITERAL_DOLLAR) || text.includes(PRINTED_LITERAL_DOLLAR)
    ? text
        .replace(SCRIPT_ELEMENT, escapedForTheBrowser)
        .replace(JSON_ATTRIBUTE, escapedForTheBrowser)
        .replaceAll(LITERAL_DOLLAR, () => '$')
        .replaceAll(PRINTED_LITERAL_DOLLAR, () => '$')
    : text

/** The keys whose subtree is data a page reads rather than text it prints. */
const DATA_KEYS: ReadonlySet<string> = new Set([
  'dataSource',
  'filter',
  'filters',
  'fetch',
  'visibility',
  'access',
  'where',
  'prefill',
  // A form's success template is filled in the browser after a submit, by a
  // reader that honours the escape itself.
  'onSuccess',
])

/**
 * {@link protectLiteralTokens} over every string of a config value, skipping
 * the {@link DATA_KEYS} subtrees. A value with nothing to protect comes back by
 * reference, so a page without an escape costs a walk and no copy.
 */
export const protectLiteralTokensDeep = <T>(value: T): T => protectValue(value) as T

const protectValue = (value: unknown): unknown => {
  if (typeof value === 'string') return protectLiteralTokens(value)
  if (Array.isArray(value)) {
    const mapped = value.map(protectValue)
    return mapped.every((item, index) => item === value[index]) ? value : mapped
  }
  if (value === null || typeof value !== 'object') return value
  const entries = Object.entries(value)
  const mapped = entries.map(
    ([key, entry]) => [key, DATA_KEYS.has(key) ? entry : protectValue(entry)] as const
  )
  return mapped.every(([, entry], index) => entry === entries[index]?.[1])
    ? value
    : Object.fromEntries(mapped)
}

/**
 * An app with every escaped token protected in what a page prints: its pages,
 * its templates, the forms a page embeds and its translations. Tables,
 * automations and the rest are never printed by a page render, so they are
 * left as written.
 */
export const protectLiteralTokensInApp = (app: App): App => {
  const printed = Object.fromEntries(
    Object.entries({
      pages: app.pages,
      components: app.components,
      forms: app.forms,
      languages: app.languages,
    }).filter(([, part]) => part !== undefined)
  )
  const protectedParts = protectLiteralTokensDeep(printed)
  return protectedParts === printed ? app : { ...app, ...protectedParts }
}

/**
 * Run a render with the escape held for its whole length: the app is
 * protected before the render's first pass, and a document it returns is
 * released after its last. Any other answer (a redirect, a refusal) carries no
 * printed text and comes back as it is.
 */
export const withLiteralTokens = async <R>(
  app: App,
  render: (app: App) => Promise<R>
): Promise<R> => {
  const result = await render(protectLiteralTokensInApp(app))
  return (typeof result === 'string' ? releaseLiteralTokens(result) : result) as R
}
