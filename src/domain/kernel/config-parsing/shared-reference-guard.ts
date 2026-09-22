/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Refuse a parsed config whose object graph is not a TREE.
 *
 * THE ATTACK. A YAML alias is a shared REFERENCE, not a copy, so one anchored
 * node can be reachable from arbitrarily many positions:
 *
 *     children: &leaf   [a, b, c]
 *     children: &mid    [{children: *leaf}, {children: *leaf}, {children: *leaf}]
 *     children:         [{children: *mid},  {children: *mid},  {children: *mid}]
 *
 * The document stays tiny while the number of reachable PATHS multiplies per
 * level. `Bun.YAML.parse` is unbothered — it stores one node and N pointers —
 * but AppSchema's decode walks the shared graph as if it were a tree and
 * MATERIALIZES it into distinct objects. Measured here against
 * `decodeAppConfigObject`, fan-out 9, each level costing ~470 more bytes:
 *
 *     level 5   2 338 B    0.10 s      +28 MB
 *     level 6   2 807 B    0.87 s     +335 MB
 *     level 7   3 276 B    6.87 s   +2 189 MB
 *
 * ~8x time and ~7x memory per level against linear growth in bytes, so level 8
 * extrapolates to ~55 s and ~17 GB — memory exhaustion rather than mere delay.
 * The exact bytes-per-level depend on how densely the aliases are encoded; the
 * exponent does not. Bun is single-threaded, so this does not merely stall one
 * automation run — it freezes the whole HTTP server.
 *
 * It is reachable UNAUTHENTICATED: `sovrium/validateConfig` behind a webhook
 * trigger parses attacker-supplied YAML. Neither existing control helps — a byte
 * cap is useless against a payload measured in single-digit kilobytes, and the
 * per-action `timeout` cannot preempt blocking synchronous JS (the handler
 * decodes inside an eagerly evaluated IIFE, before Effect ever runs).
 *
 * THE SIGNATURE, AND WHY IT IS FREE. The guard keys on the SHARING itself — a
 * node reachable by more than one path — not on any measure of size, depth or
 * expansion. That is what makes it safe to run: an expansion COUNT would have to
 * do the exponential work it is trying to prevent, whereas a first-revisit walk
 * exits at the first collision. A bomb's collisions appear almost immediately,
 * because sharing is its whole mechanism: measured 0.026 ms to flag the level-5
 * bomb above and 0.012 ms to flag a level-10 one — cost is bounded by the
 * distinct nodes seen before the first collision and FALLS as the bomb deepens,
 * because a denser bomb collides sooner. A legitimate config pays one full
 * O(nodes) walk — 425 nodes / 0.41 ms for `apps/website`, the largest shipped.
 *
 * IDENTITY, NOT VALUE. Two sibling objects that merely LOOK alike — two tables
 * each declaring a `title` field, the single most common shape in any config —
 * are distinct objects and are never flagged. Only `===` identity counts.
 *
 * ═══ WHY THIS IS AT THE PARSE SEAM AND NOT IN `decodeAppConfigObject` ═══
 *
 * The decoder is the tempting home: it is THE config choke point, so a guard
 * there would cover every entry point by construction. It is also WRONG, and the
 * reason is measurable rather than stylistic.
 *
 * The invariant this guard rests on — "a config is a tree" — is a property of
 * TEXT, not of configs. It holds for anything parsed from JSON or YAML: JSON has
 * no sharing construct at all, and no shipped YAML uses anchors (all 257 files
 * checked; the only `&`/`*`/`<<:` in the repo are CI workflows and vendored
 * docker-compose, none of which reach a config decode). It is simply FALSE of a
 * TypeScript or in-memory JS config, where sharing a `const` between sections is
 * ordinary DRY authoring — and Sovrium's own apps do exactly that:
 *
 *     apps/website/app.ts   → `favicons` shared across 40+ pages
 *     apps/partner/app.ts   → `favicons` shared across 23+ pages
 *
 * Both are refused by an unconditional decode-time guard. So would any user's
 * `defineConfig` that hoists a repeated block into a variable — an idiom nothing
 * documents as forbidden, on the majority authoring path. Trading that away to
 * defend against a YAML-only attack is a bad bargain: it converts a security
 * guard into a gratuitous authoring restriction. Adding a `skip` option instead
 * would re-open the hole one call site at a time, which is exactly what
 * `decode-app-config.ts` refuses to do for `onExcessProperty`.
 *
 * Placing the guard where the invariant is REAL costs nothing in coverage.
 * Every JSON/YAML text-to-config path funnels through `parseJsonContent` /
 * `parseYamlContent` (`content-parsing.ts`), so `sovrium validate`, `start`,
 * `build`, `reload` and `seed` are all covered — a hostile local file freezes
 * nothing. The automation handler parses separately, by design, and calls the
 * same detector.
 *
 * A hostile `.ts` config is deliberately NOT in scope. Loading one already
 * executes arbitrary code at import time, where `while (true) {}` is a simpler
 * denial of service than any alias bomb; a structural guard downstream of that
 * would add no protection it does not already lack.
 *
 * `$ref` IS UNAFFECTED — and this matters, because `$ref` is what the error
 * message tells authors to use instead. `resolveRefs` keeps no result cache, so
 * two references to the same partial produce two distinct objects. It also runs
 * strictly AFTER this guard, so even if it later gained a cache the sharing it
 * introduced would be invisible here.
 */

/**
 * Child entries of a container, each labelled with the path step that reaches it.
 * Arrays contribute `[0]`, objects contribute `.key`, so a reported path reads
 * like the config an author wrote.
 */
const entriesOf = (node: object): readonly (readonly [string, unknown])[] =>
  Array.isArray(node)
    ? node.map((value, index) => [`[${index}]`, value] as const)
    : Object.entries(node as Record<string, unknown>).map(
        ([key, value]) => [`.${key}`, value] as const
      )

/**
 * Depth-first search for the first node reachable twice, short-circuiting on the
 * first hit.
 *
 * `found ?? walk(...)` is load-bearing: once a collision is found, `??` stops
 * evaluating, so no descendant of a later sibling is ever visited. Without that
 * the walk would traverse the full expansion — becoming the denial of service it
 * exists to prevent.
 */
const walk = (node: unknown, path: string, seen: WeakSet<object>): string | undefined => {
  if (node === null || typeof node !== 'object') return undefined
  if (seen.has(node)) return path
  // eslint-disable-next-line functional/no-expression-statements -- local accumulator
  void seen.add(node)
  return entriesOf(node).reduce<string | undefined>(
    (found, [step, child]) => found ?? walk(child, `${path}${step}`, seen),
    undefined
  )
}

/**
 * Path of the first multiply-reachable node, or `undefined` when the graph is a
 * tree.
 *
 * Exported for its unit tests and for callers that want the verdict as data;
 * `assertConfigIsTree` is the enforcing wrapper.
 * @public
 */
export const findSharedReferencePath = (parsed: unknown): string | undefined =>
  walk(parsed, '$', new WeakSet<object>())

/**
 * The refusal, written for the author who hand-wrote an anchor for DRY rather
 * than for the attacker. It names the offending path, the construct responsible,
 * and — critically — the supported alternative, since `&name`/`*name` is a
 * reasonable thing to reach for and "rejected" alone leaves nowhere to go.
 * @public
 */
export const sharedReferenceMessage = (path: string): string =>
  `Config rejected: the parsed document is not a tree — the value at \`${path}\` is ` +
  `reachable by more than one path. A YAML anchor/alias (\`&name\` / \`*name\`) makes one ` +
  `node a shared reference across many positions, which expands exponentially when the ` +
  `config is decoded and can exhaust CPU and memory. Use a \`$ref\` to a separate file to ` +
  `share configuration between sections.`

/**
 * Throw unless the parsed config is a tree.
 *
 * Throwing rather than returning a verdict is deliberate at this seam: every
 * caller of `parseJsonContent` / `parseYamlContent` already handles a parse
 * throw (`Bun.YAML.parse` throws a `SyntaxError` on malformed input), so the
 * refusal surfaces through paths that exist, with no new contract and no way to
 * parse a config from text while skipping the check.
 * @public
 */
export const assertConfigIsTree = (parsed: unknown): void => {
  const shared = findSharedReferencePath(parsed)
  if (shared !== undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- parse-seam refusal, see above
    throw new Error(sharedReferenceMessage(shared))
  }
}
