/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Structural guard: refuse a config that carries a `__proto__` key anywhere.
 *
 * ─── WHY THE DECODER CANNOT DO THIS ─────────────────────────────────────────
 *
 * `AppSchema` already refuses an unrecognised key at every `Schema.Struct`
 * position — `decodeAppConfigObject` decodes with `onExcessProperty: 'error'`,
 * which is why a TOP-LEVEL `__proto__` is reported by name today.
 *
 * A `Schema.Record` position behaves in the opposite way. Effect v4 SILENTLY
 * DROPS an entry whose key fails the key schema, under every option
 * combination including `onExcessProperty: 'error'` and `errors: 'all'`; only
 * VALUE failures surface. The repo already measured this and documented it at
 * `src/domain/models/app/design/color-roles.ts`, calling a pattern check that
 * deletes its own evidence worse than no check at all.
 *
 * So `theme.colors.__proto__` decodes clean, the entry vanishes, and the author
 * is told `Valid configuration` about a file the engine did not fully accept —
 * exactly the "quietly repaired, silently stripped" outcome the decode
 * pipeline's own header forbids. That guarantee cannot be restored inside the
 * schema, because the drop happens before any schema-level reporting exists to
 * hook. It is restored here instead, over the RAW parsed object, where the key
 * still exists to be named.
 *
 * ─── WHY `__proto__` ALONE ──────────────────────────────────────────────────
 *
 * `constructor` and `prototype` are ordinary identifiers in a key position: a
 * table field, a colour token or a translation key may legitimately be called
 * either, and refusing them would be inventing a rule authors never agreed to.
 * `__proto__` is different in kind. Every JavaScript engine special-cases it on
 * assignment, so a config carrying it is either an attack or a mistake, never
 * an intent — and the only reason it survives to be seen at all is that
 * `Bun.YAML.parse` materialises it as a genuine own property rather than
 * reassigning the prototype.
 *
 * That narrowness is deliberate and is NOT the general fix for silent key
 * drops. Every other mis-keyed record entry still disappears without comment;
 * closing that class means opening the key schemas and cross-validating one
 * level up, the way `colorRoles` does, one record at a time.
 *
 * ─── NOT A MEMORY-SAFETY FIX ────────────────────────────────────────────────
 *
 * Nothing here prevents prototype pollution: `Bun.YAML.parse` does not pollute,
 * and the decoded app never carries the key. The defect being closed is a
 * REPORTING one — an author receiving a clean bill of health for a file that
 * was quietly truncated.
 */

/**
 * The one key that is never a legitimate configuration property.
 *
 * `Object.getOwnPropertyNames` is what finds it — not `Object.keys`, which sees
 * only enumerable properties and would miss a key defined non-enumerably by a
 * parser other than the two shipped today.
 */
const POLLUTING_KEY = '__proto__'

/** Join a parent path and a key into the dotted form an author can search for. */
const childPath = (parent: string, key: string): string =>
  parent === '' ? key : `${parent}.${key}`

/**
 * Collect the path of every `__proto__` own property, depth-first.
 *
 * Own-property descriptors rather than indexed reads: on a plain object
 * `node['__proto__']` resolves through the accessor inherited from
 * `Object.prototype` unless an own data property shadows it, and depending on
 * that shadowing to read a value is a distinction this walk should not be
 * betting on.
 *
 * Recursion stops AT a polluting key rather than descending through it. One
 * report per offending line is what the author acts on; enumerating whatever
 * hangs beneath a key that must be deleted outright is noise.
 */
const walk = (node: unknown, path: string): readonly string[] => {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) => walk(item, `${path}[${index}]`))
  }
  if (node === null || typeof node !== 'object') return []
  return Object.getOwnPropertyNames(node).flatMap((key) =>
    key === POLLUTING_KEY
      ? [childPath(path, key)]
      : walk(Object.getOwnPropertyDescriptor(node, key)?.value, childPath(path, key))
  )
}

/**
 * Every position in a parsed config at which `__proto__` appears as an own key.
 *
 * Paths are dotted, with array indices bracketed
 * (`tables[0].fields[1].__proto__`), so the author can search the file for the
 * line rather than being told only that something somewhere was wrong.
 *
 * Returns `[]` for the overwhelming majority of configs, which is the whole
 * cost of running it on every decode.
 *
 * @param parsed - config object as parsed from JSON / YAML / TypeScript
 * @public
 */
export const findPrototypePollutingKeys = (parsed: unknown): readonly string[] => walk(parsed, '')

/**
 * Render the findings as fatal decode errors, one line per offending position.
 *
 * The message names the key AND its path because a bare refusal — a non-zero
 * exit with nothing to search for — is the complaint this guard exists to
 * answer, not a milder version of it.
 *
 * @param parsed - config object as parsed from JSON / YAML / TypeScript
 * @public
 */
export const reportPrototypePollutingKeys = (parsed: unknown): readonly string[] =>
  findPrototypePollutingKeys(parsed).map(
    (path) =>
      `${path}: "${POLLUTING_KEY}" is not a valid configuration key. ` +
      'It is special-cased by the JavaScript runtime and is never accepted, at any position. Remove it.'
  )
