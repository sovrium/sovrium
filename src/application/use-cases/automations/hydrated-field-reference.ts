/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The id a hydrated relationship or user field stands for, kept on the
 * prototype of the hydrated object under a private symbol. Non-enumerable by
 * construction: JSON serialisation of the trigger envelope, `Object.keys` and
 * spreads of the hydrated columns are unaffected.
 */
const HYDRATED_ID: unique symbol = Symbol('sovrium.automations.hydratedId')

/**
 * Wrap a hydrated column map so the FIELD ITSELF reads as the id it stores
 * while its sub-paths (`{{…record.plan.tier}}`, `{{…record.assignee.email}}`)
 * keep resolving through the hydrated columns.
 *
 * Template rendering stringifies through `toString`, so the id lives there for
 * the renderer; it also lives under {@link HYDRATED_ID} so a resolver that
 * hands values over WITHOUT rendering them (a code step's `inputData`, the
 * props of a step inside a branch or a loop) can collapse a whole reference to
 * the field back to its id — see {@link hydratedFieldIdOf}.
 */
export const withHydratedId = (
  columns: Readonly<Record<string, unknown>>,
  id: string
): Readonly<Record<string, unknown>> =>
  Object.assign(
    Object.create({ toString: () => id, [HYDRATED_ID]: id }) as object,
    columns
  ) as Record<string, unknown>

/**
 * The id a value stands for when it is a hydrated relationship or user field
 * (built by {@link withHydratedId}), else `undefined`.
 *
 * A whole reference to such a field is its id wherever it is resolved, as it
 * already is when rendered as text: a reference reaching THROUGH the field
 * (`contact.first_name`) never lands on the hydrated object itself, so it keeps
 * reading the related row.
 */
export const hydratedFieldIdOf = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null) return undefined
  const id: unknown = (value as { readonly [HYDRATED_ID]?: unknown })[HYDRATED_ID]
  return typeof id === 'string' ? id : undefined
}
