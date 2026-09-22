/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Sentinel prefix marking a description that belongs to a USE SITE, not to the
 * schema it is attached to.
 *
 * Read by the OpenAPI adapter (`src/presentation/api/openapi/markers.ts`),
 * which duplicates the constant rather than importing it: the adapter may not
 * reach into domain for behaviour, and a shared marker string is not worth a
 * port. The two must move together.
 */
export const REF_DESCRIPTION_MARKER = 'sovrium:ref-description='

/**
 * Describe a REFERENCE to a named schema without renaming the schema.
 *
 * `commentSchema.annotate({ description: 'Created comment' })` reads like the
 * Zod `.describe()` it replaces, and is not: Effect resolves the annotation
 * against the schema, so the wording lands on the shared component and one
 * endpoint's phrasing relabels the type for every other endpoint that
 * references it. There is no way to tell the two apart in the emitted document —
 * Effect emits a full duplicate of the body under a generated name, and the
 * first duplicate encountered claims the clean one.
 *
 * So the intent is carried explicitly. A marked description is stripped from
 * the component and re-attached at the reference as
 * `allOf: [{ $ref }, { description }]` — the shape OpenAPI 3.0 requires,
 * because a `$ref` there is a replacement and any sibling keyword is discarded.
 *
 * Use this whenever the annotated schema carries an `identifier`. On an
 * anonymous schema a plain `.annotate({ description })` is correct and this
 * helper would be noise.
 */
export const describedRef = <S extends Schema.Top>(schema: S, description: string): S =>
  schema.annotate({ description: `${REF_DESCRIPTION_MARKER}${description}` }) as S

/**
 * `Schema.Unknown` that keeps its description.
 *
 * Effect DISCARDS annotations on `Schema.Unknown` — `Unknown.annotate({
 * description })` renders as a bare `{}`, so the wording never reaches the
 * document. `Schema.Any` keeps them, and the two are identical at runtime:
 * both accept every value and neither validates. The cast restores `unknown`
 * at the type level, so a caller still has to narrow before use and gains no
 * `any` in the process.
 *
 * Ten fields in the published contract carry a description on an arbitrary-JSON
 * value — `triggerData`, a step's `output` — and they are exactly the fields a
 * reader most needs prose for.
 */
export const describedUnknown = (
  description: string
): Schema.Codec<unknown, unknown, never, never> =>
  Schema.Any.annotate({ description }) as unknown as Schema.Codec<unknown, unknown, never, never>
