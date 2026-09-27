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
 * A single STATIC literal, never built from input (`sovrium/no-dynamic-regexp`).
 * The two `$record.` READERS at the foot of this file use it; the substituter
 * uses {@link SCOPED_VAR_CHAIN}, whose field charset is this one's, so a name
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
 * One token of ANY namespace, optionally continued by `|` and another token of
 * the SAME namespace — the fallback chain, generalised to a named scope.
 *
 * `$record.` is one namespace among several a page reads, and a `repeat` that
 * names its element (`as: 'leg'`) adds another. ONE static literal serves them
 * all: the namespace is CAPTURED, and the replacer below resolves only the
 * namespaces it was handed and returns every other match untouched. That is what
 * keeps the grammar single — a named scope is not a second regex that could
 * disagree with this one about what a field name is — and what keeps the rule
 * `sovrium/no-dynamic-regexp` enforces: nothing here is built from input.
 *
 * The `\1` back-reference is what confines a chain to one namespace, so
 * `$record.a|$record.b` chains while `$leg.a|$record.b` is two tokens — exactly
 * what the record-only pattern did with the second half.
 *
 * The field charset is {@link RECORD_REFERENCE}'s, `[a-zA-Z0-9_]`; a namespace
 * must start with a letter or an underscore, so `$1.50` is never a token.
 */
const SCOPED_VAR_CHAIN = /\$([a-zA-Z_][a-zA-Z0-9_]*)\.[a-zA-Z0-9_]+(?:\|\$\1\.[a-zA-Z0-9_]+)*/g

/** One scoped token, namespace and field captured — the unchained reader. */
const SCOPED_REFERENCE = /\$([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z0-9_]+)/g

/** The namespace a bare `$record.` token names. */
export const RECORD_NAMESPACE = 'record'

/**
 * The namespaces the page grammar already reads, and which a `repeat.as` may
 * therefore never take.
 *
 * Written HERE, beside the grammar, rather than in the rule that refuses them,
 * so the list moves with the grammar it describes. A name on this list would
 * make one token mean two things: `as: 'record'` would re-scope every
 * `$record.` inside the repeat, and `as: 'param'` would collide with the route
 * parameters a page substitutes before any record is known.
 */
export const RESERVED_TOKEN_NAMESPACES: readonly string[] = [
  RECORD_NAMESPACE,
  'parent',
  'param',
  'query',
  't',
  'app',
  'user',
  'currentUser',
  'session',
  'window',
  'vars',
]

/**
 * Is `name` spellable as a `$<name>.` token at all? The namespace charset of
 * {@link SCOPED_VAR_CHAIN}, anchored.
 */
export const isTokenNamespace = (name: string): boolean => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)

/**
 * A token as written: `$<namespace>.<field>`.
 *
 * Spelled ONCE: {@link repeatElementScalars} and {@link printableRecordFields}
 * write a token back out, and a second spelling could emit one the grammar above
 * does not match, which reads to an author as a binding that resolved to literal
 * text for no reason anyone can point at.
 */
const tokenText = (namespace: string, field: string): string => `$${namespace}.${field}`

/** One field, coerced: `undefined` and `null` alike become the empty string. */
const fieldText = (record: Readonly<Record<string, unknown>>, fieldName: string): string => {
  const value = record[fieldName]
  return value === undefined || value === null ? '' : String(value)
}

/**
 * Replace scoped placeholders — `$<namespace>.<field>` and `|`-separated fallback
 * chains of them — in ONE pass, each namespace against its own record.
 *
 * One pass rather than one per namespace, and the difference is a guarantee: a
 * value substituted for `$leg.from` is never scanned again, so a record holding
 * the TEXT `$record.secret` prints that text rather than the field it names.
 *
 * A namespace absent from `scopes` is left exactly as written — `$param.id` in a
 * `$record.` pass, or `$stop.city` in a copy of the enclosing leg.
 *
 * `transformValue` is applied to each substituted VALUE and never to the
 * surrounding template. That asymmetry is load-bearing: it is what lets the
 * page renderer HTML-escape record data inside an author-written HTML template
 * while leaving the author's own markup byte-identical. By the time the two are
 * one string, provenance is gone and no downstream consumer can tell them apart.
 */
export const substituteScopedVars = (
  template: string,
  scopes: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  transformValue?: (value: string) => string
): string =>
  template.replace(SCOPED_VAR_CHAIN, (match: string, namespace: string) => {
    const record = Object.hasOwn(scopes, namespace) ? scopes[namespace] : undefined
    if (record === undefined) return match
    const prefix = namespace.length + 2
    const resolved =
      match
        .split('|')
        .map((token) => fieldText(record, token.slice(prefix)))
        .find((text) => text.length > 0) ?? ''
    return transformValue ? transformValue(resolved) : resolved
  })

/**
 * Replace `$record.<field>` placeholders — and `|`-separated fallback chains of
 * them — with values from a record.
 *
 * `token` names the namespace, `record` by default: a `repeat` that names its
 * element (`as: 'leg'`) resolves `$leg.<field>` through this same function
 * rather than through a second grammar. See {@link substituteScopedVars} for the
 * `transformValue` contract.
 */
export const substituteRecordVars = (
  template: string,
  record: Readonly<Record<string, unknown>>,
  transformValue?: (value: string) => string,
  token: string = RECORD_NAMESPACE
): string => substituteScopedVars(template, { [token]: record }, transformValue)

/**
 * Every scoped token a string carries, in source order: its namespace, its
 * field, and the token as written.
 *
 * Read by the decode rule that refuses a `$<as>.` token outside the repeat that
 * declares it — reported by the token TEXT, because that is what the author has
 * to find and move.
 */
export const scopedTokensIn = (
  value: string
): readonly { readonly namespace: string; readonly field: string; readonly token: string }[] =>
  [...value.matchAll(SCOPED_REFERENCE)].map(([token, namespace, field]) => ({
    namespace: namespace as string,
    field: field as string,
    token,
  }))

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
export const repeatElementScalars = (
  element: unknown,
  token: string = RECORD_NAMESPACE
): Readonly<Record<string, unknown>> => {
  if (typeof element !== 'object' || element === null || Array.isArray(element)) return {}
  return Object.fromEntries(
    Object.entries(element as Record<string, unknown>).map(([key, value]) => [
      key,
      typeof value === 'object' && value !== null ? tokenText(token, key) : value,
    ])
  )
}

/**
 * A record projected for a TEXT site: every relationship column carrying a
 * resolved label under `_display` prints that label instead of its stored key.
 *
 * ─── TEXT SITES AND ADDRESS SITES ───────────────────────────────────────────
 *
 * The same `$record.company` means two different things depending on where it
 * lands. In a sentence a reader sees — a card title, a footer chip — it means
 * "the company", and the company's `displayField` is how the author said to
 * name it. In an address — an `onClick` path, a `url`, an `href` — it means
 * "the company's row", and only the stored key resolves: a link built from a
 * label would 404. So this projection is applied at text sites ONLY, by the
 * caller that knows which kind of site it is filling; {@link substituteRecordVars}
 * itself stays label-blind, which keeps every address site correct by default.
 *
 * A relationship with no `displayField` has no `_display` entry, so it keeps
 * printing its key — the engine never invents a label the author did not ask
 * for. A to-many label list is joined with `, `, the way a reader writes one.
 * The record is returned unchanged when it carries no labels at all.
 */
export const withDisplayLabels = (
  record: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const display = record['_display']
  if (typeof display !== 'object' || display === null || Array.isArray(display)) return record
  const labels = Object.entries(display as Record<string, unknown>).map(
    ([field, label]) => [field, Array.isArray(label) ? label.join(', ') : label] as const
  )
  return labels.length === 0 ? record : { ...record, ...Object.fromEntries(labels) }
}

/** A value `String()` would print as `[object Object]`: a plain object, or an array holding one. */
const printsAsObjectTag = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(printsAsObjectTag)
  if (typeof value !== 'object' || value === null) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * A page's OWN record, projected to what `$record.` may print on it.
 *
 * The narrow sibling of {@link repeatElementScalars}, for a record rather than
 * an element: only a value `String()` would print as `[object Object]` — a plain
 * object, or an array holding one — is mapped to its own token, and it survives
 * substitution verbatim for the reason that projection gives. Everything else is
 * untouched, so a `Date`, a number or an array of strings prints exactly as it
 * always has on a bound page.
 *
 * The one place such a value DOES print is a `code` node whose whole content is
 * that token, which reads the RAW record rather than this projection.
 */
export const printableRecordFields = (
  record: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      printsAsObjectTag(value) ? tokenText(RECORD_NAMESPACE, key) : value,
    ])
  )
