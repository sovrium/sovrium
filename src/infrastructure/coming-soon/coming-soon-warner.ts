/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Coming-Soon Runtime Warner
 *
 * At server boot, walks the validated app configuration and emits a stdout
 * warning for every property whose value reveals a coming-soon Effect
 * Schema. Two detection paths feed the same emit pipeline:
 *
 *   1. Discriminator-tag detection (`COMING_SOON_DISCRIMINATORS`):
 *      When a property named `type` or `kind` carries a string value that
 *      appears in any parent union's flagged-tag set, emit a warning that
 *      identifies the parent schema AND the tag literal. This is the
 *      primary path for partially-implemented unions (e.g. `kanban`,
 *      `calendar`) inside an otherwise-implemented `PageComponentSchema`.
 *
 *   2. Whole-file detection (`COMING_SOON_SCHEMA_NAMES`):
 *      Reserved for schemas whose ENTIRE source file is fixme-only and the
 *      property is non-discriminated. The current registry contains a
 *      handful of such names (e.g. action-template aggregates) but is
 *      gradually shrinking as discriminated unions take over. Detection
 *      here remains best-effort because the warner cannot resolve a leaf
 *      schema name from a runtime value alone — see `usageAtNode` for the
 *      narrow rule that fires.
 *
 * Stdout (not stderr): Bun's runtime wraps every stderr line with ANSI red
 * codes when FORCE_COLOR is set (Playwright sets it for E2E test runs).
 * Those codes break the line-anchored regex in
 * `specs/cli/coming-soon-flagging.spec.ts` (CLI-COMING-SOON-007), so we
 * route through stdout. The CLI test harness captures combined output and
 * the `[sovrium] ` prefix uniquely identifies our line.
 *
 * Privacy invariant: warnings contain NO spec IDs. The line formats are
 * locked by the spec regex:
 *
 *   Variant case (discriminator):
 *     [sovrium] config.<jsonPointerPath> uses '<tag>' (<ParentSchemaName>) — COMING SOON. It will be ignored at runtime.
 *
 *   Whole-file case:
 *     [sovrium] config.<jsonPointerPath> uses <SchemaName> — COMING SOON. It will be ignored at runtime.
 *
 * Wiring:
 *   - `src/index.ts:start()` calls `Effect.runSync(warnForConfig(validatedApp))`
 *     immediately after `Schema.decodeUnknownSync(AppSchema)` succeeds, so
 *     warnings appear *before* the Hono server begins listening.
 *   - The committed registry (`./registry.generated.ts`) is the only runtime
 *     dependency. No reads of the gitignored
 *     `schemas/.coming-soon.internal.json` happen here.
 */

import { Console, Effect } from 'effect'
import {
  COMING_SOON_DISCRIMINATORS,
  COMING_SOON_LEAF_SCHEMA_TAGS,
  COMING_SOON_SCHEMA_NAMES,
  COMING_SOON_TAGS,
} from './registry.generated'

/**
 * A single coming-soon usage detected in a config tree.
 *
 * `path` is a JSON-pointer-style dotted path rooted at `config`, e.g.
 * `config.tables[0].fields[1].type`. `schemaName` is the PascalCase Effect
 * Schema identifier — for the variant case this is the PARENT union schema
 * (e.g. `PageComponentSchema`). `tag`, when present, is the discriminator
 * literal (e.g. `'kanban'`); whole-file detections leave it `undefined`.
 */
export interface ComingSoonUsage {
  readonly path: string
  readonly schemaName: string
  readonly tag?: string
}

/**
 * Resolve the parent schema name for a tag by reducing over the
 * `COMING_SOON_DISCRIMINATORS` map. Returns `undefined` when the tag is
 * not flagged (caller should not have invoked us in that case but the
 * guard is cheap).
 */
const findParentForTag = (tag: string): string | undefined => {
  return [...COMING_SOON_DISCRIMINATORS.entries()].reduce<string | undefined>(
    (acc, [parentName, tags]) => acc ?? (tags.has(tag) ? parentName : undefined),
    undefined
  )
}

/**
 * Detect a coming-soon usage at the *current* node (not its descendants).
 *
 * Two narrow rules, in priority order:
 *
 *   1. **Variant**: the object has a string `type` or `kind` property
 *      whose value is in `COMING_SOON_TAGS`. Emit
 *      `{ path, schemaName: parent, tag }` — this is the partially-
 *      implemented union case (e.g. `'kanban'` inside `ComponentSchema`).
 *
 *   2. **Whole-file** (legacy): the object has a string `type` property
 *      whose value is in `COMING_SOON_LEAF_SCHEMA_TAGS`. Emit
 *      `{ path, schemaName: leafSchema }` — no `tag` field, producing
 *      the original "uses <Schema> — COMING SOON" line format. This is
 *      the path used for files with a single coming-soon schema that
 *      isn't part of an exported discriminated union (e.g.
 *      `AiTranslateFieldSchema` in `ai-translate-field.ts`).
 */
/**
 * Variant detection: object has a `type` or `kind` value that's a
 * coming-soon discriminator tag. Returns a single usage when a parent
 * union schema is found for the tag, empty otherwise.
 */
const detectVariantHit = (
  obj: Readonly<Record<string, unknown>>,
  path: string
): readonly ComingSoonUsage[] => {
  const discriminatorValue = obj.type ?? obj.kind
  if (typeof discriminatorValue !== 'string') return []
  if (!COMING_SOON_TAGS.has(discriminatorValue)) return []
  const parent = findParentForTag(discriminatorValue)
  if (parent === undefined) return []
  const propName = typeof obj.type === 'string' ? 'type' : 'kind'
  return [{ path: `${path}.${propName}`, schemaName: parent, tag: discriminatorValue }]
}

/**
 * Leaf-schema detection (legacy whole-file path): object has a `type`
 * value mapped via `COMING_SOON_LEAF_SCHEMA_TAGS` to a registry-tracked
 * schema. Returns a single usage with no `tag` field, producing the
 * locked `uses <Schema>` line format.
 */
const detectLeafHit = (
  obj: Readonly<Record<string, unknown>>,
  path: string
): readonly ComingSoonUsage[] => {
  const typeValue = obj.type
  if (typeof typeValue !== 'string') return []
  const leafSchema = COMING_SOON_LEAF_SCHEMA_TAGS.get(typeValue)
  if (leafSchema === undefined) return []
  if (!COMING_SOON_SCHEMA_NAMES.has(leafSchema)) return []
  return [{ path: `${path}.type`, schemaName: leafSchema }]
}

const usageAtNode = (node: unknown, path: string): readonly ComingSoonUsage[] => {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return []
  const obj = node as Readonly<Record<string, unknown>>
  const variantHit = detectVariantHit(obj, path)
  if (variantHit.length > 0) return variantHit
  return detectLeafHit(obj, path)
}

/**
 * Recursively walk the config tree and collect every coming-soon usage.
 *
 * Tail-recursive flatMap composition so we stay within the project's
 * functional-programming ESLint rules (no mutation, no `for` loops). Trees
 * deeper than ~10k levels would blow the JS engine stack, but configs are
 * many orders of magnitude shallower.
 */
const collectUsages = (node: unknown, path: string): readonly ComingSoonUsage[] => {
  const here = usageAtNode(node, path)

  if (Array.isArray(node)) {
    const fromItems = node.flatMap((item, index) => collectUsages(item, `${path}[${index}]`))
    return [...here, ...fromItems]
  }

  if (node !== null && typeof node === 'object') {
    const obj = node as Readonly<Record<string, unknown>>
    const fromProps = Object.keys(obj).flatMap((key) => collectUsages(obj[key], `${path}.${key}`))
    return [...here, ...fromProps]
  }

  return here
}

/**
 * Walk a validated config tree and collect every site where a discriminator
 * value maps to a coming-soon Effect Schema.
 *
 * Pure: produces no side effects, takes no logger. The caller decides how
 * to surface the result (stderr line, log entry, JSON for tooling).
 */
export const detectComingSoonUsages = (config: unknown): readonly ComingSoonUsage[] =>
  collectUsages(config, 'config')

/**
 * Format a single usage as the locked warning line.
 *
 * Two locked formats:
 *   - Variant (with `tag`):
 *     `[sovrium] <path> uses '<tag>' (<ParentSchema>) — COMING SOON. It will be ignored at runtime.`
 *   - Whole-file (no `tag`):
 *     `[sovrium] <path> uses <SchemaName> — COMING SOON. It will be ignored at runtime.`
 *
 * The em-dash (—, U+2014) is intentional and matches the regex anchor in
 * the spec. ASCII hyphens will fail the regex.
 */
export const formatComingSoonWarning = (usage: ComingSoonUsage): string => {
  if (usage.tag !== undefined) {
    return `[sovrium] ${usage.path} uses '${usage.tag}' (${usage.schemaName}) — COMING SOON. It will be ignored at runtime.`
  }
  return `[sovrium] ${usage.path} uses ${usage.schemaName} — COMING SOON. It will be ignored at runtime.`
}

/**
 * Effect program that detects coming-soon usages in `config` and emits
 * one stdout line per usage. Silent when no usages are found.
 *
 * Stdout (Console.log) rather than stderr: Bun's runtime wraps every
 * stderr line in ANSI red codes when FORCE_COLOR is set (Playwright sets
 * it for E2E test runs). Those codes break the line-anchored regex in
 * CLI-COMING-SOON-007, so we route the warning through stdout where Bun
 * leaves the bytes alone. The CLI test harness captures combined
 * stdout+stderr already, and our line is unambiguously identified by the
 * `[sovrium] ` prefix.
 */
export const warnForConfig = (config: unknown): Effect.Effect<void> =>
  Effect.gen(function* () {
    const usages = detectComingSoonUsages(config)
    yield* Effect.forEach(usages, (usage) => Console.log(formatComingSoonWarning(usage)), {
      discard: true,
    })
  })

// Re-export the registry constants as a convenience for tests and
// downstream consumers that want to introspect what's currently flagged.
export {
  COMING_SOON_DISCRIMINATORS,
  COMING_SOON_LEAF_SCHEMA_TAGS,
  COMING_SOON_SCHEMA_NAMES,
  COMING_SOON_TAGS,
}
