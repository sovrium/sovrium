/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The config keys that are DEPRECATED: still accepted, but on their way out.
 *
 * ## The policy this table carries
 *
 * On 0.x a user-facing key is removed only after ONE release in which it is
 * still accepted and `sovrium validate` / `sovrium start` print a warning
 * naming its replacement. The removal itself then lands in a `removed-keys.ts`
 * beside the component, whose message the excess-property reporter shows on
 * refusal. So a key travels: schema → this table (one release, a warning) →
 * `removed-keys.ts` (a refusal that names the replacement).
 *
 * The table is EMPTY on purpose. The two removals of 2026-10 — the table view
 * switcher and the page form's create path — were executed before the policy
 * took effect and went straight to `removed-keys.ts`; [internal ref] records them as
 * the exception.
 *
 * ## Why a walk over the raw config rather than the reporter
 *
 * The excess-property reporter runs on a decode FAILURE. A deprecated key
 * decodes — the schema still accepts it — so the reporter never sees it. This
 * module reads the parsed (pre-decode) config instead, which is why it must
 * not depend on the config being valid.
 *
 * ## What an entry has to do
 *
 * Name the replacement a reader can write today and the release that removes
 * the key. The test beside this file pins both for every entry.
 */

/** One deprecated key. */
export interface DeprecatedKey {
  /**
   * The node holding the key, as the dotted path the reporter prints with the
   * indices generalised: `pages[0].components[2]` is matched by
   * `/^pages\[\d+\]\.components\[\d+\]$/`.
   */
  readonly node: RegExp
  /** The node's `type` literal, when the key belongs to one component type only. */
  readonly discriminant?: string
  /** The property name the author wrote. */
  readonly key: string
  /** The sentence naming what to write instead. */
  readonly replacement: string
  /** The release that first warned, e.g. `0.32`. */
  readonly deprecatedIn: string
  /** The release that will refuse it, e.g. `0.33`. */
  readonly removedIn: string
}

/** One warning, for one occurrence. */
export interface DeprecationWarning {
  readonly path: string
  readonly key: string
  readonly message: string
}

/** Every deprecated key. Empty until the first deprecation under [internal ref]. */
export const DEPRECATED_KEYS: readonly DeprecatedKey[] = []

type Segment = string | number

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const pathOf = (segments: readonly Segment[]): string =>
  segments.reduce<string>(
    (acc, segment) =>
      typeof segment === 'number'
        ? `${acc}[${segment}]`
        : acc === ''
          ? segment
          : `${acc}.${segment}`,
    ''
  )

/** The warning sentence for one entry. */
const formatDeprecation = (entry: DeprecatedKey, path: string): string =>
  `\`${entry.key}\` at ${path === '' ? 'the top level' : path} is deprecated since ${entry.deprecatedIn} ` +
  `and will be refused from ${entry.removedIn}. ${entry.replacement}`

const nodeWarnings = (
  node: Readonly<Record<string, unknown>>,
  path: string,
  table: readonly DeprecatedKey[]
): readonly DeprecationWarning[] =>
  table
    .filter(
      (entry) =>
        Object.hasOwn(node, entry.key) &&
        entry.node.test(path) &&
        (entry.discriminant === undefined || node['type'] === entry.discriminant)
    )
    .map((entry) => ({ path, key: entry.key, message: formatDeprecation(entry, path) }))

const walk = (
  value: unknown,
  segments: readonly Segment[],
  table: readonly DeprecatedKey[]
): readonly DeprecationWarning[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => walk(item, [...segments, index], table))
  }
  if (!isRecord(value)) return []
  return [
    ...nodeWarnings(value, pathOf(segments), table),
    ...Object.entries(value).flatMap(([key, child]) => walk(child, [...segments, key], table)),
  ]
}

/**
 * Every deprecated key the parsed config uses, in document order. Reads the
 * RAW config (after `$ref` resolution, before decode), so it works on a config
 * that would also fail to decode for some other reason.
 *
 * @param table - Injected by the tests; production reads {@link DEPRECATED_KEYS}.
 */
export const collectDeprecationWarnings = (
  config: unknown,
  table: readonly DeprecatedKey[] = DEPRECATED_KEYS
): readonly DeprecationWarning[] => (table.length === 0 ? [] : walk(config, [], table))
