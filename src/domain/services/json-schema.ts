/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * JSON Schema Generation Service
 *
 * Pure domain logic for generating JSON Schema from Effect Schema definitions.
 * Consumed by the `sovrium schema` CLI command and by the Schema Drift gate.
 *
 * ## Dialect: draft-2020-12 (Effect 4)
 *
 * Effect 3 exposed `JSONSchema.make(schema)`, which returned a **bare** draft-07
 * JSON Schema: `{ $id, $schema, $defs, $ref }`. Effect 4 removed `make`. Its
 * producer is `Schema.toJsonSchemaDocument`, which returns a **Document
 * wrapper** — `{ dialect, schema, definitions }` — in draft-2020-12.
 *
 * The wrapper is a transport container, NOT a JSON Schema: an editor pointed at
 * a file with those three keys sees no `type` and no `properties`, and silently
 * validates nothing. So the published artifact is the wrapper **flattened** into
 * a conforming draft-2020-12 document — the same flattening Effect itself
 * performs in `Schema.toStandardJSONSchemaV1` (`Schema.ts`, `schema.$defs =
 * doc.definitions`). That is a serialization step, not a translation layer:
 * no dialect conversion, no ref rewriting, no post-processing.
 *
 * Draft-2020-12 keeps `$defs` and `#/$defs/<name>` ref targets, so the shape of
 * every `$defs` consumer is unchanged from v3. What DOES change for users is the
 * `$schema` URI, the root (inlined rather than `$ref: "#/$defs/App"`), and the
 * generated content — see the Phase 6 semantic diff in
 * `scripts/migration/effect4/CLASSIFICATION.md`.
 *
 * ## Post-processors: deleted, because v4 no longer emits what they compensated
 *
 * `fixEmptyPatternProperties` compensated for v3 `Record({key, value})` emitting
 * `patternProperties: { "": … }` alongside `propertyNames.pattern`.
 * `stripConstraintTitles` stripped auto-generated constraint labels such as
 * `maxLength(63)`. Measured against native v4 output over the whole AppSchema:
 * **0 empty-string `patternProperties` keys** and **0 constraint-pattern
 * `title`s or `description`s** out of 589 titles / 1,736 descriptions. Both were
 * dead. Dead compensation matching a shape that no longer occurs is how the next
 * migration gets confused, so they are removed rather than retained.
 */

import { Schema } from 'effect'
import { AppSchema } from '@/domain/models/app'

/** Stable, versionless `$id` for the published schema. */
export const APP_JSON_SCHEMA_ID = 'https://sovrium.com/schema/app.json'

/** Meta-schema URI for JSON Schema draft-2020-12. */
export const APP_JSON_SCHEMA_DIALECT_URI = 'https://json-schema.org/draft/2020-12/schema'

/**
 * Assert the generated document is actually walkable before anything consumes it.
 *
 * This replaces the interim `$defs`-non-empty tripwire, and is deliberately
 * stronger than it. Non-emptiness alone is not enough: the interim reshape
 * carried a NON-EMPTY `definitions` map whose refs had been rewritten to
 * `#/definitions/<name>` by `toDocumentDraft07`, so every `$ref` lookup missed
 * and path extraction silently degraded while the tripwire stayed green.
 *
 * So the invariant checked here is **ref resolvability**, not presence: at least
 * one `$ref` must exist, and every distinct `$ref` target must be present in
 * `$defs`. A shape that cannot be walked now crashes instead of yielding a
 * confident zero — `check-progress` runs `--no-error` in CI, where a zero would
 * report GREEN while measuring nothing.
 */
// This is a TRIPWIRE, and its whole value is that it terminates the process
// loudly at the point of failure. Returning a Result/Effect would make the
// failure something a caller can ignore, which is precisely the outcome it
// exists to prevent: `check-progress` runs `--no-error` in CI, so a soft
// failure reads GREEN while measuring nothing. The mutable `Set` and the
// `for..of` are a local ref accumulator over a JSON tree, never observable
// outside this function.
/* eslint-disable functional/no-throw-statements, functional/immutable-data, functional/no-expression-statements, functional/no-loop-statements */
const assertWalkable = (schema: Readonly<Record<string, unknown>>): void => {
  const defs = schema['$defs'] as Record<string, unknown> | undefined
  if (defs === undefined || Object.keys(defs).length === 0) {
    throw new Error(
      'generateAppJsonSchema: produced no $defs. The Effect 4 JsonSchema Document -> ' +
        'JSON Schema serialization is wrong; fix it rather than letting every consumer ' +
        'that walks $defs silently read zero.'
    )
  }

  const refs = new Set<string>()
  const collect = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(collect)
      return
    }
    const obj = node as Record<string, unknown>
    const ref = obj['$ref']
    if (typeof ref === 'string') refs.add(ref)
    for (const value of Object.values(obj)) collect(value)
  }
  collect(schema)

  if (refs.size === 0) {
    throw new Error(
      'generateAppJsonSchema: produced $defs but no $ref anywhere. Definitions that ' +
        'nothing references mean the document was serialized with mismatched ref targets.'
    )
  }

  const unresolvable = [...refs].filter((ref) => {
    if (!ref.startsWith('#/$defs/')) return true
    return !(ref.slice('#/$defs/'.length) in defs)
  })
  if (unresolvable.length > 0) {
    throw new Error(
      `generateAppJsonSchema: ${unresolvable.length} $ref target(s) do not resolve against ` +
        `$defs (e.g. ${unresolvable.slice(0, 3).join(', ')}). The document is not walkable; ` +
        'consumers would silently stop at each unresolved ref.'
    )
  }
}
/* eslint-enable functional/no-throw-statements, functional/immutable-data, functional/no-expression-statements, functional/no-loop-statements */

/**
 * Generate the published JSON Schema for `AppSchema`.
 *
 * Returns a conforming **draft-2020-12** document: Effect 4's
 * `Schema.toJsonSchemaDocument` wrapper flattened, with `$id` and `$schema`
 * metadata applied and `definitions` hoisted to `$defs`.
 */
export const generateAppJsonSchema = (): Readonly<Record<string, unknown>> => {
  const document = Schema.toJsonSchemaDocument(AppSchema)

  const schema: Readonly<Record<string, unknown>> = {
    $id: APP_JSON_SCHEMA_ID,
    $schema: APP_JSON_SCHEMA_DIALECT_URI,
    ...(document.schema as unknown as Record<string, unknown>),
    $defs: document.definitions,
  }

  assertWalkable(schema)

  return schema
}
