/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE `$record.*` substitutor. One implementation, one coercion contract, one
 * grammar — used by every surface that interpolates a record into a template.
 *
 * ─── ONE COERCION, AND WHY IT USED TO BE FOUR ───────────────────────────────
 *
 * A missing field (`undefined`) and an explicit `null` both resolve to the
 * EMPTY STRING; every other value is coerced with `String(value)`.
 *
 * That rule was previously written four times and agreed twice. The page
 * renderer's copy tested `value !== undefined` only, so a nullable column
 * painted the literal text `null` into a heading; the kanban card and this
 * module mapped `null` to `''`; the search island carried a fourth copy that
 * agreed with the renderer. The divergence was tracked in this file's own
 * header as a follow-up for long enough that two islands had grown local
 * work-arounds for it. It is now closed by DELETING the other three: the
 * renderer, the kanban card template and the search island all delegate here.
 *
 * `null` renders as nothing because that is what a null column MEANS to a
 * reader. `String(null)` is a JavaScript detail leaking into a document, and a
 * document that says `null` where a title belongs is worse than one that says
 * nothing.
 *
 * ─── THE FALLBACK CHAIN ─────────────────────────────────────────────────────
 *
 * `$record.title|$record.slug` resolves to the FIRST candidate that is
 * non-empty after the coercion above, and to the empty string when none is.
 *
 * It exists because "render the title, or the slug when there is none" is a
 * DISPLAY decision, and Sovrium's rule is that the console composes while an
 * endpoint publishes facts. Without a chain the only ways to
 * express it were to publish a pre-composed `displayTitle` from every endpoint
 * whose title is nullable — a per-endpoint tax for a general expression — or to
 * duplicate the whole subtree behind two `visibility.record` gates, which has
 * no presence operator to gate on.
 *
 * The delimiter is deliberately UN-SPACED and each continuation must be spelled
 * in full. `'$record.name | Sovrium'` is a real page-title template and does NOT
 * chain: the space breaks the `|$record.` continuation, so the literal pipe
 * survives untouched. `'$record.a|b'` is likewise unchanged — only `$record.`
 * continues a chain.
 */

/**
 * ONE `$record.<field>` reference, capturing the field name.
 *
 * A single STATIC literal, never built from input (`sovrium/no-dynamic-regexp`),
 * and the ONE spelling of the token in this file: the substituter, the chain
 * grammar below and the two readers at the foot all derive from it, so a name
 * one half resolves cannot be a name another half fails to see. That is the
 * failure `PARAM_REFERENCE` has to guard against by hand — its grammar is copied
 * across two modules, with a comment on each copy explaining why the copies must
 * agree.
 *
 * The field charset is `[a-zA-Z0-9_]`, so `$record.foo-bar` matches
 * `$record.foo` and leaves `-bar` as literal text.
 *
 * `/g` makes it stateful under `.exec` / `.test`, and neither is used: `.replace`
 * resets `lastIndex` when it finishes, and `.matchAll` iterates a clone.
 */
const RECORD_REFERENCE = /\$record\.([a-zA-Z0-9_]+)/g

/**
 * One token, optionally continued by `|` and another token — the fallback chain.
 *
 * BUILT from {@link RECORD_REFERENCE} rather than written out again, so the two
 * cannot drift on what a field name is. Its capture groups are inherited and
 * unused: the substituter reads the whole match and re-splits it, because a
 * repeated group captures only its last iteration.
 */
const RECORD_VAR_CHAIN = new RegExp(
  `${RECORD_REFERENCE.source}(?:\\|${RECORD_REFERENCE.source})*`,
  'g'
)

/**
 * The token's literal prefix, and its length.
 *
 * Spelled ONCE for the reason {@link RECORD_REFERENCE} is: the substituter
 * slices it off a matched token, and {@link repeatElementScalars} writes it back
 * out again. A projection that spelled it a second time could emit a token the
 * regex above does not match, which reads to an author as a binding that
 * resolved to literal text for no reason anyone can point at.
 */
const TOKEN = '$record.'
const TOKEN_PREFIX = TOKEN.length

/** One field, coerced: `undefined` and `null` alike become the empty string. */
const fieldText = (record: Readonly<Record<string, unknown>>, fieldName: string): string => {
  const value = record[fieldName]
  return value === undefined || value === null ? '' : String(value)
}

/**
 * Replace `$record.<field>` placeholders — and `|`-separated fallback chains of
 * them — with values from a record.
 *
 * `transformValue` is applied to each substituted VALUE and never to the
 * surrounding template. That asymmetry is load-bearing: it is what lets the
 * page renderer HTML-escape record data inside an author-written HTML template
 * while leaving the author's own markup byte-identical. By the time the two are
 * one string, provenance is gone and no downstream consumer can tell them apart.
 */
export const substituteRecordVars = (
  template: string,
  record: Readonly<Record<string, unknown>>,
  transformValue?: (value: string) => string
): string =>
  template.replace(RECORD_VAR_CHAIN, (match: string) => {
    const resolved =
      match
        .split('|')
        .map((token) => fieldText(record, token.slice(TOKEN_PREFIX)))
        .find((text) => text.length > 0) ?? ''
    return transformValue ? transformValue(resolved) : resolved
  })

/**
 * The field names a string references, in source order — empty when it
 * references none.
 *
 * Read by the decode rule that refuses a reference with no record to resolve it
 * against (`page-binding-validation.ts`, family 14). It reports the NAMES rather
 * than a boolean because an author told "this page has a stray reference" tries
 * a different spelling, while one told WHICH field goes looking for the binding
 * that was supposed to supply it.
 */
export const recordFieldRefsIn = (value: string): readonly string[] =>
  [...value.matchAll(RECORD_REFERENCE)].map(([, field]) => field as string)

/**
 * True when a string is EXACTLY one `$record.<field>` reference and nothing
 * else — no surrounding text, no second reference.
 *
 * The anchored sibling of {@link recordFieldRefsIn}, and the ROUTE-parameter
 * shape's counterpart (`parseRouteParamRef`): both answer "is this whole value a
 * deferred reference?" rather than "does it contain one?".
 *
 * That distinction is what lets a decode-time VALUE check stand down. A field
 * whose value is wholly a reference — `subject.type: '$record.type'`,
 * `swatch.token: '$record.token'` — carries a ROW fact, not a config fact,
 * so a catalogue-membership or token-resolution test run at boot would be
 * testing the literal text `$record.type`. It is the same exemption
 * `$param.<name>` subjects already get, for the same reason. A value that merely
 * CONTAINS a reference (`'Role: $record.name'`) is a template, and every check
 * that applied to it before still applies.
 *
 * A FALLBACK CHAIN (`'$record.title|$record.slug'`) is deliberately NOT accepted
 * here. It resolves like a reference, but it is a template by construction — it
 * names two fields and picks between them — so it keeps every value check a
 * template gets. `recordFieldRefsIn` still reports both of its names, which is
 * what the family-14 decode rule needs.
 */
export const isRecordFieldRef = (value: unknown): value is string =>
  typeof value === 'string' && /^\$record\.[a-zA-Z0-9_]+$/.test(value)

/**
 * One element of a repeated array, projected to what this substituter may
 * legitimately PRINT ([internal ref] CAP-6).
 *
 * Inside a `repeat`, `$record.<key>` names a key on the ELEMENT rather than on
 * the drawer's record, and the elements of a `json` column are arbitrary: a key
 * can hold a nested object or an array. {@link substituteRecordVars} has ONE
 * coercion — `String(value)` for everything that is not `undefined`/`null` — and
 * widening it here would re-open the divergence this module closed by deleting
 * three copies of the rule. So the projection decides what is printable, and the
 * substituter keeps its single contract.
 *
 * Three classes, and the third is the one with a real choice behind it:
 *
 *  - a SCALAR (string, number, boolean) passes through unchanged;
 *  - `null`, `undefined`, and a key the element simply does not carry all reach
 *    the substituter as absent, so they resolve to the empty string — the same
 *    thing a null column means anywhere else. This is what makes a key the
 *    RECORD carries and the element does not (`$record.scope` over a per-step
 *    element) print nothing rather than leaking the drawer's value;
 *  - an OBJECT- or ARRAY-valued key is mapped to its own token text, so it
 *    survives substitution VERBATIM.
 *
 * That last mapping is deliberate and the alternatives are worse. `String({})`
 * is `[object Object]`, which looks like data and is the exact string that moved
 * a step payload to a JSON renderer in the first place. An empty string is
 * indistinguishable from a null column, which is a real and DIFFERENT fact. A
 * surviving `$record.payload` can only mean "this binding did not resolve", and
 * it names the key that did not — the diagnosable option. A structured renderer
 * inside a repeat is its own capability; until it exists, this is the honest
 * answer rather than a coercion nobody chose.
 *
 * A non-object element (a bare string in the array) carries no keys at all, so
 * every token in the copy resolves to the empty string.
 *
 * NOTE for a fallback chain: a token mapped to its own text is non-empty, so
 * `$record.payload|$record.name` stops at `payload`. That is consistent — the
 * chain picks the first key that RESOLVED, and an object-valued one did not
 * resolve to anything printable — but it is a corner the grammar does not
 * currently test, so it is written down rather than discovered.
 */
export const repeatElementScalars = (element: unknown): Readonly<Record<string, unknown>> => {
  if (typeof element !== 'object' || element === null || Array.isArray(element)) return {}
  return Object.fromEntries(
    Object.entries(element as Record<string, unknown>).map(([key, value]) => [
      key,
      typeof value === 'object' && value !== null ? `${TOKEN}${key}` : value,
    ])
  )
}
