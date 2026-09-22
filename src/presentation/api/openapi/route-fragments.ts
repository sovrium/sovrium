/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The public surface: the four fragment builders a route descriptor calls.
 *
 * `effectSchema` for a bare schema node, `effectParameters` for path/query,
 * `effectJsonResponse` and `effectJsonBody` for the two message bodies. Every
 * other module here exists to make these four correct.
 */

import { Schema } from 'effect'
import { withComponents } from './components-registry'
import { documentedSides } from './document-sides'
import { emptyToNullable, inlineDefs, normalize } from './normalize'
import { convert } from './schema-to-json'
import type { JsonSchema } from './markers'
import type { RouteSpec } from './route-spec'

/**
 * Convert an Effect Schema to a JSON-Schema object for a response or request
 * body position.
 *
 * `$defs` are INLINED rather than hoisted to `components/schemas`. Hoisting
 * would need a second output channel into the document builder, and would
 * collide with the `.openapi('Name')` components Zod schemas already register —
 * two schemas claiming one component name is the failure mode recorded in
 * `reference_duplicate_schema_identifier_erases_defs.md`. Inlining is what the
 * unnamed Zod schemas in this codebase already produce, so it keeps the diff
 * limited to the schema body.
 */
export const effectSchema = (schema: Schema.Top): JsonSchema => {
  const { schema: body, definitions } = documentedSides(schema)
  // `emptyToNullable` at the ROOT as well as at every child position. `normalize`
  // applies it while descending, so a schema that IS unconstrained — a bare
  // `Schema.Unknown` used as a whole request body — was never reached by it and
  // published `{}` where the document said `{ nullable: true }`.
  return normalize(
    emptyToNullable(inlineDefs(body as JsonSchema, definitions as JsonSchema, []))
  ) as JsonSchema
}

/** Where a parameter lives. `path` parameters are always required. */
type ParameterLocation = 'query' | 'path' | 'header'

type ParameterObject = {
  readonly name: string
  readonly in: ParameterLocation
  readonly required: boolean
  readonly schema: JsonSchema
  readonly description?: string
}

/**
 * Convert an Effect Struct to an OpenAPI `parameters[]` array.
 *
 * One entry per property. `required` follows the schema's own `required` list
 * for query and header parameters; a path parameter is required by definition
 * (OpenAPI forbids `required: false` there) regardless of how the schema
 * declares it, which matches what zod-to-openapi does for `request.params`.
 *
 * The property `description` is lifted to the parameter level as well as left
 * on the schema — that is the shape zod-to-openapi produces from
 * `z.string().describe(...)`, so consumers see no change.
 */
export const effectParameters = (
  schema: Schema.Top,
  location: ParameterLocation
  // Mutable, not `readonly`: `openapi3-ts` types `OperationObject['parameters']`
  // as a mutable array, and `RouteSpec['parameters']` is derived from it. The
  // array is freshly built here and never retained, so nothing can observe the
  // mutability.
): ParameterObject[] => {
  const { properties } = effectSchema(schema)
  if (typeof properties !== 'object' || properties === null) return []
  // `required` comes from the ENCODED side, the schema from the DECODED one,
  // and the split is not a nicety: a parameter carrying a default is OPTIONAL on
  // the wire — that is the whole point of the default — while the decoded value
  // it produces is always present. Reading `required` off the decoded side
  // would publish every defaulted query parameter as mandatory.
  const encodedRequired = Schema.toJsonSchemaDocument(schema as never).schema['required']
  const requiredNames = Array.isArray(encodedRequired) ? (encodedRequired as readonly string[]) : []
  return Object.entries(properties as Record<string, JsonSchema>).map(([name, propertySchema]) => {
    const { description } = propertySchema
    return {
      name,
      in: location,
      required: location === 'path' ? true : requiredNames.includes(name),
      schema: propertySchema,
      ...(typeof description === 'string' ? { description } : {}),
    }
  })
}

/**
 * Build an `application/json` response entry from an Effect Schema — the
 * Effect-side twin of `jsonResponse` in `route-spec.ts`.
 */
export const effectJsonResponse = (
  schema: Schema.Top,
  description: string
): NonNullable<RouteSpec['responses']>[number] => {
  const { schema: body, components } = convert(schema)
  return withComponents(
    { content: { 'application/json': { schema: body } }, description },
    components
  ) as never
}

/**
 * Build an `application/json` request-body entry from an Effect Schema.
 *
 * The body schema reaches `@hono/zod-openapi` as a plain object, so its
 * `isZod` guard skips attaching a validator. That is correct here and nowhere
 * else: this OpenAPI app is a documentation-only Hono instance whose handlers
 * are `(c) => c.json({})` stubs and which never serves traffic. Runtime
 * validation for these routes lives on the real app, in
 * `src/presentation/api/routes/`.
 */
export const effectJsonBody = (schema: Schema.Top) => {
  const { schema: body, components } = convert(schema)
  return withComponents({ content: { 'application/json': { schema: body } } }, components) as never
}
